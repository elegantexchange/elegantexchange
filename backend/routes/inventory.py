"""Inventory routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, timedelta, date
from typing import List
import uuid

from models import InventoryItemCreate, InventoryItemUpdate, BulkAction
from auth import get_current_user
from id_gen import next_item_id

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _today_iso() -> str:
    return date.today().isoformat()


def _period_end(date_in_iso: str) -> str:
    d = date.fromisoformat(date_in_iso[:10])
    return (d + timedelta(days=60)).isoformat()


async def _refresh_expired(db):
    today = _today_iso()
    await db.inventory.update_many(
        {"status": "Active", "period_end": {"$lte": today}},
        {"$set": {"status": "Expired"}},
    )


@router.get("")
async def list_inventory(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    await _refresh_expired(db)
    items = await db.inventory.find({}, {"_id": 0}).sort("date_in", -1).to_list(10000)
    # Attach consignor name
    cids = list({i["consignor_id"] for i in items})
    cmap = {}
    async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
        cmap[c["consignor_id"]] = c["full_name"]
    for i in items:
        i["consignor_name"] = cmap.get(i["consignor_id"], "")
    return items


@router.post("")
async def create_item(
    body: InventoryItemCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    consignor = await db.consignors.find_one({"consignor_id": body.consignor_id})
    if not consignor:
        raise HTTPException(status_code=400, detail="Unknown consignor")
    date_in = body.date_in or _today_iso()
    item_id = await next_item_id(db, body.consignor_id)
    doc = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "consignor_id": body.consignor_id,
        "description": body.description,
        "category": body.category,
        "size": body.size or "",
        "condition": body.condition or "",
        "asking_price": float(body.asking_price),
        "date_in": date_in,
        "period_end": _period_end(date_in),
        "status": "Active",
        "date_sold": None,
        "sale_price": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/batch")
async def create_items_batch(
    payload: dict, request: Request, _u: dict = Depends(get_current_user)
):
    """Batch intake: { consignor_id, items: [...] }"""
    db = request.app.state.db
    consignor_id = payload.get("consignor_id")
    items_in = payload.get("items", [])
    consignor = await db.consignors.find_one({"consignor_id": consignor_id})
    if not consignor:
        raise HTTPException(status_code=400, detail="Unknown consignor")
    created = []
    for raw in items_in:
        date_in = raw.get("date_in") or _today_iso()
        item_id = await next_item_id(db, consignor_id)
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor_id,
            "description": raw.get("description", ""),
            "category": raw.get("category", ""),
            "size": raw.get("size", ""),
            "condition": raw.get("condition", ""),
            "asking_price": float(raw.get("asking_price", 0)),
            "date_in": date_in,
            "period_end": _period_end(date_in),
            "status": "Active",
            "date_sold": None,
            "sale_price": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    return {"items": created, "consignor": {"consignor_id": consignor_id, "full_name": consignor["full_name"]}}


@router.get("/{item_id}")
async def get_item(item_id: str, request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    item = await db.inventory.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@router.patch("/{item_id}")
async def update_item(
    item_id: str,
    body: InventoryItemUpdate,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True}
    await db.inventory.update_one({"item_id": item_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{item_id}")
async def delete_item(item_id: str, request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    sale = await db.sales.find_one({"item_id": item_id})
    if sale:
        raise HTTPException(status_code=400, detail="Cannot delete item with sales")
    await db.inventory.delete_one({"item_id": item_id})
    return {"ok": True}


@router.post("/bulk")
async def bulk_action(
    body: BulkAction, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    status_map = {
        "sold": "Sold",
        "donated": "Donated",
        "returned": "Returned",
        "active": "Active",
    }
    new_status = status_map.get(body.action)
    update = {"status": new_status}
    if body.action == "sold":
        update["date_sold"] = _today_iso()
    await db.inventory.update_many(
        {"item_id": {"$in": body.item_ids}}, {"$set": update}
    )
    return {"ok": True, "updated": len(body.item_ids)}
