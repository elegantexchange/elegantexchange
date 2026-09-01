"""Sales routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, date
import uuid

from models import SaleCreate
from auth import get_current_user, normalize_role, require_roles
from boutique_settings import resolve_consignor_split_pct, split_sale_amount
from floor_operator import operator_from_request

router = APIRouter(prefix="/api/sales", tags=["sales"])

_RETAIL_HIDDEN = (
    "store_cut",
    "consignor_cut",
    "consignor_split_pct",
    "payout_status",
    "payout_date",
    "payout_method",
)


@router.get("")
async def list_sales(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    sales = await db.sales.find({}, {"_id": 0}).sort("sale_date", -1).to_list(10000)
    # Attach consignor + item info
    cids = list({s["consignor_id"] for s in sales})
    cmap = {}
    async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
        cmap[c["consignor_id"]] = c["full_name"]
    iids = list({s["item_id"] for s in sales})
    imap = {}
    async for i in db.inventory.find({"item_id": {"$in": iids}}, {"_id": 0}):
        media = list(i.get("media") or [])
        imap[i["item_id"]] = {
            "description": i.get("description", ""),
            "media": media,
        }
    retail = normalize_role(_u.get("role")) == "retail"
    for s in sales:
        info = imap.get(s["item_id"]) or {}
        s["consignor_name"] = cmap.get(s["consignor_id"], "")
        s["description"] = info.get("description", "")
        s["media"] = list(info.get("media") or [])
        if retail:
            for key in _RETAIL_HIDDEN:
                s.pop(key, None)
    return sales


@router.post("")
async def create_sale(
    body: SaleCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    item = await db.inventory.find_one({"item_id": body.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    consignor = await db.consignors.find_one(
        {"consignor_id": item["consignor_id"]}, {"_id": 0}
    )
    sale_price = float(body.sale_price)
    split_pct = resolve_consignor_split_pct(item, consignor)
    store_cut, consignor_cut = split_sale_amount(sale_price, split_pct)
    sale_date = body.sale_date or date.today().isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "sale_date": sale_date,
        "item_id": body.item_id,
        "consignor_id": item["consignor_id"],
        "sale_price": sale_price,
        "store_cut": store_cut,
        "consignor_cut": consignor_cut,
        "consignor_split_pct": split_pct,
        "square_transaction_id": None,
        "payout_status": "Pending",
        "payout_date": None,
        "payout_method": None,
        "notes": body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": operator_from_request(request),
        "created_by": _u.get("email") or "",
    }
    await db.sales.insert_one(doc)
    await db.inventory.update_one(
        {"item_id": body.item_id},
        {"$set": {"status": "Sold", "date_sold": sale_date, "sale_price": sale_price}},
    )
    doc.pop("_id", None)
    if normalize_role(_u.get("role")) == "retail":
        for key in _RETAIL_HIDDEN:
            doc.pop(key, None)
    return doc


@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: str,
    request: Request,
    _u: dict = Depends(require_roles("admin", "manager")),
):
    db = request.app.state.db
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Not found")
    if sale["payout_status"] == "Paid":
        raise HTTPException(status_code=400, detail="Cannot delete a paid sale")
    await db.sales.delete_one({"id": sale_id})
    # Restore item to Active
    await db.inventory.update_one(
        {"item_id": sale["item_id"]},
        {"$set": {"status": "Active", "date_sold": None, "sale_price": None}},
    )
    return {"ok": True}
