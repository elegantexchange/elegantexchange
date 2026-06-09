"""Square API integration routes (OAuth + sync)."""
import os
import secrets
import httpx
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/square", tags=["square"])


def _square_base() -> str:
    env = os.environ.get("SQUARE_ENVIRONMENT", "sandbox").lower()
    return (
        "https://connect.squareupsandbox.com"
        if env == "sandbox"
        else "https://connect.squareup.com"
    )


def _api_base() -> str:
    env = os.environ.get("SQUARE_ENVIRONMENT", "sandbox").lower()
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


@router.get("/status")
async def status(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    doc = await db.square_connection.find_one({"_id": "default"}, {"_id": 0})
    return {
        "configured": _square_configured(),
        "environment": os.environ.get("SQUARE_ENVIRONMENT", "sandbox"),
        "connected": bool(doc and doc.get("access_token")),
        "merchant_id": (doc or {}).get("merchant_id"),
        "connected_at": (doc or {}).get("connected_at"),
        "last_sync_at": (doc or {}).get("last_sync_at"),
    }


@router.get("/connect")
async def connect(request: Request):
    """Redirect to Square OAuth authorize URL.
    Note: this is called from a browser <a> tag; auth is checked via cookie.
    """
    # Make sure user is authenticated (will raise 401 if not)
    await get_current_user(request)

    if not _square_configured():
        raise HTTPException(status_code=400, detail="Square is not configured. Add credentials in Settings.")

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
        return RedirectResponse(url=f"{frontend}/settings?square=invalid_state", status_code=302)
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
        return RedirectResponse(url=f"{frontend}/settings?square=token_error", status_code=302)
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
async def disconnect(request: Request, _o: dict = Depends(require_owner)):
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


@router.post("/sync")
async def sync(request: Request, _u: dict = Depends(get_current_user)):
    """Pull recent payments from Square and attempt to match by SKU/note to inventory."""
    db = request.app.state.db
    doc = await db.square_connection.find_one({"_id": "default"})
    if not doc or not doc.get("access_token"):
        raise HTTPException(status_code=400, detail="Square is not connected")

    headers = {
        "Authorization": f"Bearer {doc['access_token']}",
        "Square-Version": "2024-10-17",
        "Content-Type": "application/json",
    }
    matched = 0
    unmatched = 0
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{_api_base()}/v2/payments?limit=50&sort_order=DESC",
                headers=headers,
            )
        if r.status_code >= 300:
            raise HTTPException(status_code=400, detail=f"Square error: {r.text}")
        payments = r.json().get("payments", [])
        for p in payments:
            tx_id = p.get("id")
            note = (p.get("note") or "").strip()
            order_id = p.get("order_id")
            amount = (p.get("amount_money") or {}).get("amount", 0) / 100.0
            # Skip if already synced
            existing_log = await db.square_sync_log.find_one({"transaction_id": tx_id})
            if existing_log and existing_log.get("status") == "matched":
                continue
            # Try to match by EE-### in note
            matched_item_id = None
            import re
            m = re.search(r"EE-\d{3}-\d{2}", note)
            if m:
                candidate = m.group(0)
                item = await db.inventory.find_one({"item_id": candidate})
                if item:
                    matched_item_id = candidate
            if matched_item_id:
                # Check if a sale already exists for this txn
                existing_sale = await db.sales.find_one(
                    {"square_transaction_id": tx_id}
                )
                if not existing_sale:
                    item = await db.inventory.find_one({"item_id": matched_item_id})
                    if item:
                        import uuid
                        sale_price = float(amount)
                        store_cut = round(sale_price * 0.5, 2)
                        consignor_cut = round(sale_price - store_cut, 2)
                        sale_date = (
                            (p.get("created_at") or "")[:10]
                            or date.today().isoformat()
                        )
                        sale_doc = {
                            "id": str(uuid.uuid4()),
                            "sale_date": sale_date,
                            "item_id": matched_item_id,
                            "consignor_id": item["consignor_id"],
                            "sale_price": sale_price,
                            "store_cut": store_cut,
                            "consignor_cut": consignor_cut,
                            "square_transaction_id": tx_id,
                            "payout_status": "Pending",
                            "payout_date": None,
                            "payout_method": None,
                            "notes": f"Square sync · order {order_id}",
                            "created_at": datetime.now(timezone.utc).isoformat(),
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
                await db.square_sync_log.update_one(
                    {"transaction_id": tx_id},
                    {
                        "$set": {
                            "transaction_id": tx_id,
                            "matched_item_id": matched_item_id,
                            "status": "matched",
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "sale_amount": amount,
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
    return {"matched": matched, "unmatched": unmatched}


@router.get("/unmatched")
async def unmatched(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    rows = await db.square_sync_log.find(
        {"status": "unmatched"}, {"_id": 0}
    ).sort("synced_at", -1).limit(100).to_list(100)
    return rows


@router.post("/unmatched/{transaction_id}/dismiss")
async def dismiss_unmatched(
    transaction_id: str, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    await db.square_sync_log.update_one(
        {"transaction_id": transaction_id}, {"$set": {"status": "dismissed"}}
    )
    return {"ok": True}
