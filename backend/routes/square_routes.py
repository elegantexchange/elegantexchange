"""Square API integration routes (OAuth + sync + POS charge)."""
import os
import asyncio
import re
import secrets
import uuid
import httpx
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from auth import get_current_user, normalize_role, require_roles
from boutique_settings import resolve_consignor_split_pct, split_sale_amount
from floor_operator import operator_from_request
from models import SquareChargeComplete, SquareChargeCreate
from sale_ops import (
    attach_square_transaction,
    clear_liability_sales_for_item,
    find_real_sale_for_item,
    insert_sale,
    upsert_square_payment,
)

router = APIRouter(prefix="/api/square", tags=["square"])

_RETAIL_HIDDEN = (
    "store_cut",
    "consignor_cut",
    "consignor_split_pct",
    "payout_status",
    "payout_date",
    "payout_method",
)


def _square_base() -> str:
    env = os.environ.get("SQUARE_ENVIRONMENT", "sandbox").lower()
    return (
        "https://connect.squareupsandbox.com"
        if env == "sandbox"
        else "https://connect.squareup.com"
    )


def _api_base(doc: dict | None = None) -> str:
    env = (
        ((doc or {}).get("environment") or "")
        or os.environ.get("SQUARE_ENVIRONMENT", "sandbox")
    ).lower()
    return (
        "https://connect.squareupsandbox.com"
        if env == "sandbox"
        else "https://connect.squareup.com"
    )


def _square_configured() -> bool:
    return bool(
        os.environ.get("SQUARE_APPLICATION_ID")
        and os.environ.get("SQUARE_APPLICATION_SECRET")
        and os.environ.get("SQUARE_REDIRECT_URI")
    )


async def _refresh_square_token(db, doc: dict) -> dict:
    """Refresh Square access token when expired or near expiry."""
    refresh = (doc or {}).get("refresh_token")
    if not refresh or not _square_configured():
        return doc or {}

    expires_at = (doc.get("expires_at") or "").strip()
    needs_refresh = True
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            needs_refresh = exp <= datetime.now(timezone.utc) + timedelta(days=1)
        except Exception:
            needs_refresh = True
    if not needs_refresh:
        return doc

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{_api_base(doc)}/oauth2/token",
            json={
                "client_id": os.environ["SQUARE_APPLICATION_ID"],
                "client_secret": os.environ["SQUARE_APPLICATION_SECRET"],
                "grant_type": "refresh_token",
                "refresh_token": refresh,
            },
        )
    if r.status_code >= 300:
        detail = r.text
        try:
            detail = r.json()
        except Exception:
            pass
        raise HTTPException(
            status_code=401,
            detail=(
                "Square login expired — open Settings → Square POS → Disconnect, "
                f"then Connect again. ({detail})"
            ),
        )
    data = r.json()
    updates = {
        "access_token": data.get("access_token") or doc.get("access_token"),
        "expires_at": data.get("expires_at") or doc.get("expires_at"),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.get("refresh_token"):
        updates["refresh_token"] = data["refresh_token"]
    if data.get("merchant_id"):
        updates["merchant_id"] = data["merchant_id"]
    await db.square_connection.update_one({"_id": "default"}, {"$set": updates})
    return {**doc, **updates}


async def _square_auth_headers(db) -> tuple[dict, dict]:
    """Return (headers, connection_doc) with a valid access token."""
    doc = await db.square_connection.find_one({"_id": "default"})
    if not doc or not doc.get("access_token"):
        raise HTTPException(status_code=400, detail="Square is not connected")
    doc = await _refresh_square_token(db, doc)
    headers = {
        "Authorization": f"Bearer {doc['access_token']}",
        "Square-Version": "2024-10-17",
        "Content-Type": "application/json",
    }
    return headers, doc


def _pos_callback_url() -> str:
    frontend = (os.environ.get("FRONTEND_URL") or "http://localhost:3000").rstrip("/")
    return f"{frontend}/sales"


@router.get("/status")
async def status(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.square_connection.find_one({"_id": "default"}, {"_id": 0})
    app_id = os.environ.get("SQUARE_APPLICATION_ID") or ""
    return {
        "configured": _square_configured(),
        "environment": os.environ.get("SQUARE_ENVIRONMENT", "sandbox"),
        "connected": bool(doc and doc.get("access_token")),
        "merchant_id": (doc or {}).get("merchant_id"),
        "connected_at": (doc or {}).get("connected_at"),
        "last_sync_at": (doc or {}).get("last_sync_at"),
        "application_id": app_id,
        "pos_callback_url": _pos_callback_url(),
    }


@router.get("/connect")
async def connect(request: Request):
    """Redirect to Square OAuth authorize URL.
    Note: this is called from a browser <a> tag; auth is checked via cookie.
    """
    user = await get_current_user(request)
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Requires one of: admin")

    if not _square_configured():
        raise HTTPException(
            status_code=400, detail="Square is not configured. Add credentials in Settings."
        )

    state = secrets.token_urlsafe(24)
    db = request.app.state.db
    await db.square_oauth_state.insert_one(
        {"state": state, "created_at": datetime.now(timezone.utc).isoformat()}
    )
    scope = "ORDERS_READ PAYMENTS_READ MERCHANT_PROFILE_READ ITEMS_READ".replace(
        " ", "+"
    )
    authorize_url = (
        f"{_square_base()}/oauth2/authorize"
        f"?client_id={os.environ['SQUARE_APPLICATION_ID']}"
        f"&scope={scope}"
        f"&session=false"
        f"&state={state}"
        f"&redirect_uri={os.environ['SQUARE_REDIRECT_URI']}"
    )
    return RedirectResponse(url=authorize_url, status_code=302)


@router.get("/callback")
async def callback(request: Request, code: str | None = None, state: str | None = None):
    db = request.app.state.db
    frontend = os.environ.get("FRONTEND_URL", "/")
    if not code or not state:
        return RedirectResponse(url=f"{frontend}/settings?square=error", status_code=302)
    found = await db.square_oauth_state.find_one({"state": state})
    if not found:
        return RedirectResponse(
            url=f"{frontend}/settings?square=invalid_state", status_code=302
        )
    await db.square_oauth_state.delete_one({"state": state})

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{_api_base()}/oauth2/token",
            json={
                "client_id": os.environ["SQUARE_APPLICATION_ID"],
                "client_secret": os.environ["SQUARE_APPLICATION_SECRET"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": os.environ["SQUARE_REDIRECT_URI"],
            },
        )
    if r.status_code >= 300:
        return RedirectResponse(
            url=f"{frontend}/settings?square=token_error", status_code=302
        )
    data = r.json()
    await db.square_connection.update_one(
        {"_id": "default"},
        {
            "$set": {
                "access_token": data.get("access_token"),
                "refresh_token": data.get("refresh_token"),
                "merchant_id": data.get("merchant_id"),
                "expires_at": data.get("expires_at"),
                "environment": os.environ.get("SQUARE_ENVIRONMENT", "sandbox"),
                "connected_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return RedirectResponse(url=f"{frontend}/settings?square=connected", status_code=302)


@router.post("/disconnect")
async def disconnect(request: Request, _o: dict = Depends(require_roles("admin"))):
    db = request.app.state.db
    doc = await db.square_connection.find_one({"_id": "default"})
    if not doc:
        return {"ok": True}
    # Best-effort revoke
    try:
        if doc.get("access_token") and _square_configured():
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{_api_base()}/oauth2/revoke",
                    headers={
                        "Authorization": f"Client {os.environ['SQUARE_APPLICATION_SECRET']}",
                        "Square-Version": "2024-10-17",
                    },
                    json={
                        "client_id": os.environ["SQUARE_APPLICATION_ID"],
                        "access_token": doc["access_token"],
                    },
                )
    except Exception:
        pass
    await db.square_connection.delete_one({"_id": "default"})
    return {"ok": True}


@router.post("/charge")
async def start_charge(
    body: SquareChargeCreate,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Create a pending charge and return Square Point of Sale deep-link fields."""
    if not _square_configured():
        raise HTTPException(status_code=400, detail="Square is not configured")
    db = request.app.state.db
    conn = await db.square_connection.find_one({"_id": "default"})
    if not conn or not conn.get("access_token"):
        raise HTTPException(status_code=400, detail="Square is not connected")

    item = await db.inventory.find_one({"item_id": body.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.get("status") != "Active":
        raise HTTPException(status_code=400, detail="Item is not Active")

    price = float(body.sale_price)
    if price <= 0:
        raise HTTPException(status_code=400, detail="Sale price must be greater than 0")

    amount_cents = int(round(price * 100))
    if amount_cents < 1:
        raise HTTPException(status_code=400, detail="Sale price too small")

    # Square POS note always carries the piece id for attribution / sync
    pos_notes = body.item_id
    extra = (body.notes or "").strip()
    if extra:
        pos_notes = f"{body.item_id} · {extra}"[:500]

    charge_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pending = {
        "id": charge_id,
        "item_id": body.item_id,
        "sale_price": price,
        "notes": body.notes or "",
        "pos_notes": pos_notes,
        "status": "pending",
        "operator_name": operator_from_request(request),
        "created_by": user.get("email") or "",
        "created_at": now,
        "sale_id": None,
        "square_transaction_id": None,
    }
    await db.pending_square_charges.insert_one(pending)

    return {
        "state": charge_id,
        "amount_cents": amount_cents,
        "currency": "USD",
        "notes": pos_notes,
        "client_id": os.environ.get("SQUARE_APPLICATION_ID") or "",
        "callback_url": _pos_callback_url(),
        "item_id": body.item_id,
        "sale_price": price,
    }


@router.post("/charge/complete")
async def complete_charge(
    body: SquareChargeComplete,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Finalize a pending charge after Square Point of Sale callback."""
    db = request.app.state.db
    pending = await db.pending_square_charges.find_one({"id": body.state})
    if not pending:
        raise HTTPException(status_code=404, detail="Pending charge not found")

    if pending.get("status") == "completed" and pending.get("sale_id"):
        sale = await db.sales.find_one({"id": pending["sale_id"]}, {"_id": 0})
        if sale:
            if normalize_role(user.get("role")) == "retail":
                for key in _RETAIL_HIDDEN:
                    sale.pop(key, None)
            return {"ok": True, "sale": sale, "idempotent": True}

    if body.status != "ok":
        await db.pending_square_charges.update_one(
            {"id": body.state},
            {
                "$set": {
                    "status": "canceled",
                    "error_code": body.error_code or "payment_canceled",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        return {
            "ok": False,
            "canceled": True,
            "error_code": body.error_code or "payment_canceled",
        }

    tx_id = (body.transaction_id or body.client_transaction_id or "").strip()
    if not tx_id:
        raise HTTPException(
            status_code=400, detail="Missing Square transaction id from callback"
        )

    # Idempotent if this Square txn already created a sale
    existing = await db.sales.find_one({"square_transaction_id": tx_id}, {"_id": 0})
    if existing:
        await db.pending_square_charges.update_one(
            {"id": body.state},
            {
                "$set": {
                    "status": "completed",
                    "sale_id": existing["id"],
                    "square_transaction_id": tx_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        if normalize_role(user.get("role")) == "retail":
            for key in _RETAIL_HIDDEN:
                existing.pop(key, None)
        return {"ok": True, "sale": existing, "idempotent": True}

    item = await db.inventory.find_one({"item_id": pending["item_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Floor already logged this piece — just attach the Square txn
    existing_item_sale = await find_real_sale_for_item(db, pending["item_id"])
    if existing_item_sale:
        doc = await attach_square_transaction(
            db,
            existing_item_sale,
            square_transaction_id=tx_id,
            sale_amount=pending.get("sale_price"),
            note="Square charge",
        )
        await db.pending_square_charges.update_one(
            {"id": body.state},
            {
                "$set": {
                    "status": "completed",
                    "sale_id": doc["id"],
                    "square_transaction_id": tx_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        await db.square_sync_log.update_one(
            {"transaction_id": tx_id},
            {
                "$set": {
                    "transaction_id": tx_id,
                    "matched_item_id": pending["item_id"],
                    "status": "matched",
                    "synced_at": datetime.now(timezone.utc).isoformat(),
                    "sale_amount": pending["sale_price"],
                    "note": pending.get("pos_notes") or pending["item_id"],
                    "source": "pos_charge",
                }
            },
            upsert=True,
        )
        if normalize_role(user.get("role")) == "retail":
            for key in _RETAIL_HIDDEN:
                doc.pop(key, None)
        return {"ok": True, "sale": doc, "idempotent": True, "linked": True}

    if item.get("status") not in ("Active", "Expired"):
        raise HTTPException(
            status_code=400,
            detail="Item is no longer on the floor — sale may already be recorded",
        )

    sale_notes = pending.get("notes") or ""
    if sale_notes:
        sale_notes = f"{sale_notes} · Square charge"
    else:
        sale_notes = "Square charge"

    doc = await insert_sale(
        db,
        item=item,
        sale_price=pending["sale_price"],
        notes=sale_notes,
        square_transaction_id=tx_id,
        operator_name=pending.get("operator_name") or operator_from_request(request),
        created_by=pending.get("created_by") or user.get("email") or "",
    )

    await db.pending_square_charges.update_one(
        {"id": body.state},
        {
            "$set": {
                "status": "completed",
                "sale_id": doc["id"],
                "square_transaction_id": tx_id,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    # Mark sync log so later payment sync won't double-create
    await db.square_sync_log.update_one(
        {"transaction_id": tx_id},
        {
            "$set": {
                "transaction_id": tx_id,
                "matched_item_id": pending["item_id"],
                "status": "matched",
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "sale_amount": pending["sale_price"],
                "note": pending.get("pos_notes") or pending["item_id"],
                "source": "pos_charge",
            }
        },
        upsert=True,
    )

    # Cache POS charge on Square payments ledger for charts
    await upsert_square_payment(
        db,
        {
            "id": tx_id,
            "status": "COMPLETED",
            "amount_money": {
                "amount": int(round(float(pending["sale_price"]) * 100)),
                "currency": "USD",
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "note": pending.get("pos_notes") or pending["item_id"],
            "order_id": None,
        },
    )

    if normalize_role(user.get("role")) == "retail":
        for key in _RETAIL_HIDDEN:
            doc.pop(key, None)
    return {"ok": True, "sale": doc, "idempotent": False}


async def run_square_sync(
    db,
    *,
    lookback_days: int = 90,
    max_pages: int = 15,
) -> dict:
    """Pull Square payments, cache them, and match boutique piece ids in notes.

    Returns counts: matched, unmatched, pulled.
    """
    headers, doc = await _square_auth_headers(db)

    matched = 0
    unmatched = 0
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            payments = []
            cursor = None
            last_sync = (doc or {}).get("last_sync_at")
            begin_floor = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            begin_dt = begin_floor
            if last_sync and lookback_days < 90:
                # Overlap one day so late-settling payments aren't missed
                try:
                    ls = datetime.fromisoformat(str(last_sync).replace("Z", "+00:00"))
                    candidate = ls - timedelta(days=1)
                    if candidate > begin_floor:
                        begin_dt = candidate
                except Exception:
                    pass
            begin = begin_dt.strftime("%Y-%m-%dT00:00:00Z")
            for _ in range(max_pages):
                params = {
                    "limit": 100,
                    "sort_order": "DESC",
                    "begin_time": begin,
                }
                if cursor:
                    params["cursor"] = cursor
                r = await client.get(
                    f"{_api_base(doc)}/v2/payments",
                    headers=headers,
                    params=params,
                )
                if r.status_code == 401:
                    doc["expires_at"] = "2000-01-01T00:00:00Z"
                    await db.square_connection.update_one(
                        {"_id": "default"}, {"$set": {"expires_at": doc["expires_at"]}}
                    )
                    headers, doc = await _square_auth_headers(db)
                    r = await client.get(
                        f"{_api_base(doc)}/v2/payments",
                        headers=headers,
                        params=params,
                    )
                if r.status_code >= 300:
                    body_text = r.text
                    if r.status_code == 401:
                        raise HTTPException(
                            status_code=401,
                            detail=(
                                "Square login expired — open Settings → Square POS → "
                                "Disconnect, then Connect again."
                            ),
                        )
                    raise HTTPException(
                        status_code=400, detail=f"Square error: {body_text}"
                    )
                body = r.json()
                batch = body.get("payments") or []
                payments.extend(batch)
                cursor = body.get("cursor")
                if not cursor or not batch:
                    break

        for p in payments:
            tx_id = p.get("id")
            note = (p.get("note") or "").strip()
            order_id = p.get("order_id")
            amount = (p.get("amount_money") or {}).get("amount", 0) / 100.0
            payment_date = (p.get("created_at") or "")[:10] or date.today().isoformat()

            await upsert_square_payment(db, p)

            existing_log = await db.square_sync_log.find_one({"transaction_id": tx_id})
            if existing_log and existing_log.get("status") == "matched":
                matched += 1
                continue
            existing_sale = await db.sales.find_one({"square_transaction_id": tx_id})
            if existing_sale:
                await db.square_sync_log.update_one(
                    {"transaction_id": tx_id},
                    {
                        "$set": {
                            "transaction_id": tx_id,
                            "matched_item_id": existing_sale.get("item_id"),
                            "status": "matched",
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "sale_amount": amount,
                            "payment_date": payment_date,
                            "note": note,
                        }
                    },
                    upsert=True,
                )
                matched += 1
                continue

            matched_item_id = None
            candidates = re.findall(r"(?:EE-)?\d{4}(?:-\d{2})?", note)
            for candidate in candidates:
                bare = candidate.replace("EE-", "")
                item = await db.inventory.find_one(
                    {
                        "item_id": {
                            "$in": [bare, candidate, f"EE-{bare.split('-')[0]}"]
                        },
                        "status": {"$in": ["Active", "Expired", "Sold"]},
                    }
                )
                if not item and "-" not in bare:
                    item = await db.inventory.find_one(
                        {
                            "consignor_id": bare,
                            "status": {"$in": ["Active", "Expired"]},
                        },
                        sort=[("date_in", -1)],
                    )
                if item:
                    matched_item_id = item["item_id"]
                    break
            if matched_item_id:
                item = await db.inventory.find_one({"item_id": matched_item_id})
                sale_date = (
                    (p.get("created_at") or "")[:10] or date.today().isoformat()
                )
                existing_item_sale = await find_real_sale_for_item(db, matched_item_id)
                if existing_item_sale:
                    await attach_square_transaction(
                        db,
                        existing_item_sale,
                        square_transaction_id=tx_id,
                        sale_amount=float(amount),
                        note=f"Square sync · order {order_id}",
                    )
                elif item and item.get("status") in ("Active", "Expired"):
                    sale_price = float(amount)
                    consignor = await db.consignors.find_one(
                        {"consignor_id": item["consignor_id"]}, {"_id": 0}
                    )
                    split_pct = resolve_consignor_split_pct(item, consignor)
                    store_cut, consignor_cut = split_sale_amount(
                        sale_price, split_pct
                    )
                    sale_doc = {
                        "id": str(uuid.uuid4()),
                        "sale_date": sale_date,
                        "item_id": matched_item_id,
                        "consignor_id": item["consignor_id"],
                        "sale_price": sale_price,
                        "store_cut": store_cut,
                        "consignor_cut": consignor_cut,
                        "consignor_split_pct": split_pct,
                        "square_transaction_id": tx_id,
                        "payout_status": "Pending",
                        "payout_date": None,
                        "payout_method": None,
                        "notes": f"Square sync · order {order_id}",
                        "source": "square",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "operator_name": "",
                        "created_by": "square_sync",
                    }
                    await db.sales.insert_one(sale_doc)
                    await db.inventory.update_one(
                        {"item_id": matched_item_id},
                        {
                            "$set": {
                                "status": "Sold",
                                "date_sold": sale_date,
                                "sale_price": sale_price,
                            }
                        },
                    )
                    await clear_liability_sales_for_item(db, matched_item_id)
                else:
                    await db.square_sync_log.update_one(
                        {"transaction_id": tx_id},
                        {
                            "$set": {
                                "transaction_id": tx_id,
                                "status": "unmatched",
                                "synced_at": datetime.now(timezone.utc).isoformat(),
                                "sale_amount": amount,
                                "payment_date": payment_date,
                                "note": note,
                            }
                        },
                        upsert=True,
                    )
                    unmatched += 1
                    continue

                await db.square_sync_log.update_one(
                    {"transaction_id": tx_id},
                    {
                        "$set": {
                            "transaction_id": tx_id,
                            "matched_item_id": matched_item_id,
                            "status": "matched",
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "sale_amount": amount,
                            "payment_date": payment_date,
                            "note": note,
                        }
                    },
                    upsert=True,
                )
                matched += 1
            else:
                await db.square_sync_log.update_one(
                    {"transaction_id": tx_id},
                    {
                        "$set": {
                            "transaction_id": tx_id,
                            "status": "unmatched",
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "sale_amount": amount,
                            "payment_date": payment_date,
                            "note": note,
                        }
                    },
                    upsert=True,
                )
                unmatched += 1
    finally:
        await db.square_connection.update_one(
            {"_id": "default"},
            {"$set": {"last_sync_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"matched": matched, "unmatched": unmatched, "pulled": matched + unmatched}


_AUTO_SYNC_LOCK = asyncio.Lock()
_AUTO_SYNC_MIN_INTERVAL_SEC = 45


async def maybe_auto_sync(
    db,
    *,
    min_interval_sec: int = _AUTO_SYNC_MIN_INTERVAL_SEC,
    lookback_days: int = 14,
    max_pages: int = 8,
) -> dict | None:
    """Throttled Square pull for Home/Sales/background — no-op if recently synced."""
    if db is None:
        return None
    if _AUTO_SYNC_LOCK.locked():
        return None
    async with _AUTO_SYNC_LOCK:
        doc = await db.square_connection.find_one({"_id": "default"})
        if not doc or not doc.get("access_token"):
            return None
        last = doc.get("last_sync_at")
        if last and min_interval_sec > 0:
            try:
                ls = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - ls).total_seconds()
                if age < min_interval_sec:
                    return None
            except Exception:
                pass
        try:
            return await run_square_sync(
                db, lookback_days=lookback_days, max_pages=max_pages
            )
        except HTTPException:
            return None
        except Exception:
            return None


@router.post("/sync")
async def sync(request: Request, _u: dict = Depends(require_roles("admin", "manager"))):
    """Pull recent payments from Square and attempt to match by SKU/note to inventory."""
    db = request.app.state.db
    return await run_square_sync(db, lookback_days=90, max_pages=15)


@router.get("/unmatched")
async def unmatched(
    request: Request, _u: dict = Depends(require_roles("admin", "manager"))
):
    db = request.app.state.db
    rows = (
        await db.square_sync_log.find({"status": "unmatched"}, {"_id": 0})
        .sort("synced_at", -1)
        .limit(100)
        .to_list(100)
    )
    return rows


@router.post("/unmatched/{transaction_id}/dismiss")
async def dismiss_unmatched(
    transaction_id: str,
    request: Request,
    _u: dict = Depends(require_roles("admin", "manager")),
):
    db = request.app.state.db
    await db.square_sync_log.update_one(
        {"transaction_id": transaction_id}, {"$set": {"status": "dismissed"}}
    )
    return {"ok": True}
