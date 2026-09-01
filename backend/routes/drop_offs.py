"""Pending drop-off sessions — signed client intake awaiting item assessment."""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime, timezone, date, timedelta
import uuid

from auth import get_current_user
from floor_operator import operator_from_request
from boutique_settings import current_consignor_split_pct
from id_gen import next_item_id
from models import DropOffCreate, DropOffAssess

router = APIRouter(prefix="/api/drop-offs", tags=["drop-offs"])


def _today_iso() -> str:
    return date.today().isoformat()


def _period_end(date_in: str) -> str:
    try:
        d = date.fromisoformat(date_in[:10])
    except Exception:
        d = date.today()
    return (d + timedelta(days=60)).isoformat()


@router.get("")
async def list_drop_offs(
    request: Request,
    status: str | None = Query(None),
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    q: dict = {}
    if status:
        q["status"] = status
    rows = await db.drop_offs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Enrich with consignor name
    ids = list({r["consignor_id"] for r in rows if r.get("consignor_id")})
    names: dict[str, str] = {}
    if ids:
        cursor = db.consignors.find(
            {"consignor_id": {"$in": ids}},
            {"_id": 0, "consignor_id": 1, "full_name": 1},
        )
        async for c in cursor:
            names[c["consignor_id"]] = c.get("full_name") or ""
    for r in rows:
        r["consignor_name"] = names.get(r.get("consignor_id"), "")
    return rows


@router.post("")
async def create_drop_off(
    body: DropOffCreate,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    consignor = await db.consignors.find_one(
        {"consignor_id": body.consignor_id}, {"_id": 0}
    )
    if not consignor:
        raise HTTPException(status_code=404, detail="Consignor not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "consignor_id": body.consignor_id,
        "status": "needs_assessment",
        "created_at": now,
        "signed_at": body.signed_at or now,
        "assessed_at": None,
        "item_ids": [],
        "created_by": _u.get("email") or "",
        "operator_name": operator_from_request(request),
    }
    await db.drop_offs.insert_one(doc)
    doc.pop("_id", None)
    doc["consignor_name"] = consignor.get("full_name") or ""
    return doc


@router.get("/{drop_off_id}")
async def get_drop_off(
    drop_off_id: str,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    doc = await db.drop_offs.find_one({"id": drop_off_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Drop-off not found")
    c = await db.consignors.find_one(
        {"consignor_id": doc["consignor_id"]},
        {"_id": 0, "full_name": 1, "phone": 1, "email": 1},
    )
    doc["consignor_name"] = (c or {}).get("full_name") or ""
    doc["consignor_phone"] = (c or {}).get("phone") or ""
    doc["consignor_email"] = (c or {}).get("email") or ""
    return doc


@router.post("/{drop_off_id}/assess")
async def assess_drop_off(
    drop_off_id: str,
    body: DropOffAssess,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    session = await db.drop_offs.find_one({"id": drop_off_id})
    if not session:
        raise HTTPException(status_code=404, detail="Drop-off not found")
    if session.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Drop-off already assessed")

    consignor_id = session["consignor_id"]
    consignor = await db.consignors.find_one({"consignor_id": consignor_id})
    if not consignor:
        raise HTTPException(status_code=400, detail="Unknown consignor")

    items_in = body.items or []
    if not items_in:
        raise HTTPException(status_code=400, detail="Add at least one item")

    split_pct = await current_consignor_split_pct(db)
    created = []
    item_ids = []
    for raw in items_in:
        desc = (raw.get("description") or "").strip()
        try:
            price = float(raw.get("asking_price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if len(desc) < 2 or price <= 0:
            continue
        date_in = raw.get("date_in") or _today_iso()
        item_id = await next_item_id(db, consignor_id)
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor_id,
            "description": desc,
            "category": raw.get("category") or "Other",
            "size": raw.get("size") or "",
            "condition": raw.get("condition") or "",
            "asking_price": price,
            "date_in": date_in,
            "period_end": _period_end(date_in),
            "status": "Active",
            "date_sold": None,
            "sale_price": None,
            "rack": raw.get("rack") or "",
            "color": raw.get("color") or "",
            "text_id": raw.get("text_id") or "",
            "media": list(raw.get("media") or []),
            "consignor_split_pct": split_pct,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
        item_ids.append(item_id)

    if not created:
        raise HTTPException(
            status_code=400, detail="Each item needs a description and price"
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.drop_offs.update_one(
        {"id": drop_off_id},
        {
            "$set": {
                "status": "completed",
                "assessed_at": now,
                "item_ids": item_ids,
                "assessed_by": _u.get("email") or "",
                "assessed_by_operator": operator_from_request(request),
            }
        },
    )

    return {
        "drop_off_id": drop_off_id,
        "consignor_id": consignor_id,
        "created": len(created),
        "items": created,
        "item_ids": item_ids,
    }
