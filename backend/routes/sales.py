"""Sales routes."""
from fastapi import APIRouter, Depends, HTTPException, Request

from models import SaleCreate
from auth import get_current_user, normalize_role, require_roles
from floor_operator import operator_from_request
from sale_ops import insert_sale, real_sales_mongo_filter, resolve_sale_source

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
    # Floor + Square sales only — expired-floor / opening-balance owed stay on Payouts
    sales = (
        await db.sales.find(real_sales_mongo_filter(), {"_id": 0})
        .sort("sale_date", -1)
        .to_list(10000)
    )
    # Attach consignor + item info
    cids = list({s["consignor_id"] for s in sales if s.get("consignor_id")})
    cmap = {}
    if cids:
        async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
            cmap[c["consignor_id"]] = c["full_name"]
    iids = list({s["item_id"] for s in sales if s.get("item_id")})
    imap = {}
    if iids:
        async for i in db.inventory.find({"item_id": {"$in": iids}}, {"_id": 0}):
            media = list(i.get("media") or [])
            imap[i["item_id"]] = {
                "description": i.get("description", ""),
                "media": media,
            }
    retail = normalize_role(_u.get("role")) == "retail"
    out = []
    for s in sales:
        info = imap.get(s["item_id"]) or {}
        from house_stock import HOUSE_DISPLAY_NAME, is_house_consignor_id, is_house_item

        if is_house_consignor_id(s.get("consignor_id")) or is_house_item(s):
            s["consignor_name"] = HOUSE_DISPLAY_NAME
            s["is_house"] = True
        else:
            s["consignor_name"] = cmap.get(s["consignor_id"], "")
            s.setdefault("is_house", False)
        s["description"] = info.get("description", "")
        s["media"] = list(info.get("media") or [])
        s["source"] = resolve_sale_source(s)
        if retail:
            for key in _RETAIL_HIDDEN:
                s.pop(key, None)
        out.append(s)

    # Surface unmatched Square payments so Sales shows every synced Square charge
    if not retail:
        seen_tx = {
            s.get("square_transaction_id")
            for s in sales
            if s.get("square_transaction_id")
        }
        async for row in db.square_sync_log.find(
            {"status": "unmatched"}, {"_id": 0}
        ).sort("synced_at", -1).limit(200):
            tx_id = row.get("transaction_id")
            if not tx_id or tx_id in seen_tx:
                continue
            amount = float(row.get("sale_amount") or 0)
            note = (row.get("note") or "").strip()
            synced = row.get("synced_at") or ""
            out.append(
                {
                    "id": f"square-unmatched-{tx_id}",
                    "sale_date": (synced[:10] if synced else ""),
                    "item_id": "",
                    "consignor_id": "",
                    "consignor_name": "Square · unmatched",
                    "description": note or "Square payment — needs item match",
                    "media": [],
                    "sale_price": amount,
                    "store_cut": amount,
                    "consignor_cut": 0,
                    "consignor_split_pct": None,
                    "square_transaction_id": tx_id,
                    "payout_status": "Unmatched",
                    "payout_date": None,
                    "payout_method": None,
                    "notes": note,
                    "created_at": synced,
                    "source": "square_unmatched",
                    "operator_name": "",
                    "created_by": "",
                }
            )
        out.sort(key=lambda s: s.get("sale_date") or "", reverse=True)

    return out


@router.post("")
async def create_sale(
    body: SaleCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    item = await db.inventory.find_one({"item_id": body.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Expired pieces are still on the floor until sold / donated / returned
    if item.get("status") not in ("Active", "Expired"):
        raise HTTPException(status_code=400, detail="Item is not on the floor")
    doc = await insert_sale(
        db,
        item=item,
        sale_price=body.sale_price,
        notes=body.notes or "",
        square_transaction_id=None,
        operator_name=operator_from_request(request),
        created_by=_u.get("email") or "",
        sale_date=body.sale_date,
    )
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
