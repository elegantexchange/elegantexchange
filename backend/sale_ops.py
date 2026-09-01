"""Shared sale insert used by manual Log Sale and Square charge complete."""
from datetime import datetime, timezone, date
import uuid

from boutique_settings import resolve_consignor_split_pct, split_sale_amount


async def insert_sale(
    db,
    *,
    item: dict,
    sale_price: float,
    notes: str = "",
    square_transaction_id: str | None = None,
    operator_name: str = "",
    created_by: str = "",
    sale_date: str | None = None,
) -> dict:
    consignor = await db.consignors.find_one(
        {"consignor_id": item["consignor_id"]}, {"_id": 0}
    )
    price = float(sale_price)
    split_pct = resolve_consignor_split_pct(item, consignor)
    store_cut, consignor_cut = split_sale_amount(price, split_pct)
    sale_date = sale_date or date.today().isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "sale_date": sale_date,
        "item_id": item["item_id"],
        "consignor_id": item["consignor_id"],
        "sale_price": price,
        "store_cut": store_cut,
        "consignor_cut": consignor_cut,
        "consignor_split_pct": split_pct,
        "square_transaction_id": square_transaction_id,
        "payout_status": "Pending",
        "payout_date": None,
        "payout_method": None,
        "notes": notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": operator_name or "",
        "created_by": created_by or "",
    }
    await db.sales.insert_one(doc)
    await db.inventory.update_one(
        {"item_id": item["item_id"]},
        {"$set": {"status": "Sold", "date_sold": sale_date, "sale_price": price}},
    )
    doc.pop("_id", None)
    return doc
