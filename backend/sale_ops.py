"""Shared sale insert used by manual Log Sale and Square charge complete."""
from collections import defaultdict
from datetime import datetime, timezone, date
import uuid

from boutique_settings import resolve_consignor_split_pct, split_sale_amount

# Pending rows that track money owed — not boutique floor / Square sales.
LIABILITY_SOURCES = frozenset(
    {
        "expired_floor",
        "import_opening_balance",
        "opening_balance",
    }
)
LIABILITY_CREATED_BY = frozenset(
    {
        "expired_backfill",
        "hygiene",
        "import",
    }
)


def is_liability_sale(doc: dict | None) -> bool:
    """True for owed/backfill rows that must not appear as Sales."""
    if not doc:
        return False
    src = (doc.get("source") or "").strip()
    if src in LIABILITY_SOURCES:
        return True
    if (doc.get("created_by") or "").strip() in LIABILITY_CREATED_BY:
        return True
    notes = doc.get("notes") or ""
    if notes.startswith("Expired floor"):
        return True
    if notes.startswith("Backfill from imported sold"):
        return True
    if notes.startswith("Imported opening balance"):
        return True
    item_id = doc.get("item_id") or ""
    if item_id.startswith("OPENING-"):
        return True
    return False


def real_sales_mongo_filter() -> dict:
    """Mongo filter: Square + floor-logged sales only (excludes payout liabilities)."""
    return {
        "$and": [
            {"source": {"$nin": list(LIABILITY_SOURCES)}},
            {"created_by": {"$nin": list(LIABILITY_CREATED_BY)}},
            {
                "notes": {
                    "$not": {
                        "$regex": r"^(Expired floor|Backfill from imported sold|Imported opening balance)"
                    }
                }
            },
            {"item_id": {"$not": {"$regex": r"^OPENING-"}}},
        ]
    }


def resolve_sale_source(doc: dict) -> str:
    """UI/API source label without wiping liability provenance."""
    raw = (doc.get("source") or "").strip()
    if raw in LIABILITY_SOURCES:
        return raw
    if doc.get("square_transaction_id"):
        return "square"
    if raw in ("manual", "square", "square_unmatched"):
        return raw
    return raw or "manual"


async def upsert_square_payment(db, payment: dict) -> dict | None:
    """Cache a Square Payment for Sales today / trend / analytics (no duplicates)."""
    tx_id = (payment.get("id") or "").strip()
    if not tx_id:
        return None
    status = (payment.get("status") or "").upper()
    amount = (payment.get("amount_money") or {}).get("amount", 0) / 100.0
    # Net of refunds when Square provides it
    net = payment.get("net_amount_money") or payment.get("total_money")
    if isinstance(net, dict) and net.get("amount") is not None:
        amount = float(net["amount"]) / 100.0
    created = payment.get("created_at") or ""
    payment_date = created[:10] if created else date.today().isoformat()
    doc = {
        "transaction_id": tx_id,
        "status": status,
        "amount": round(float(amount), 2),
        "payment_date": payment_date,
        "created_at": created,
        "note": (payment.get("note") or "").strip(),
        "order_id": payment.get("order_id"),
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.square_payments.update_one(
        {"transaction_id": tx_id},
        {"$set": doc},
        upsert=True,
    )
    return doc


async def combined_daily_revenue(
    db, start_iso: str, end_iso: str | None = None
) -> dict[str, float]:
    """Square COMPLETED charges + floor-logged sales without a Square txn.

    Matched Square sales are counted via square_payments only, so Sync never
    double-counts a floor log that was later linked to the same payment.
    """
    by_day: dict[str, float] = defaultdict(float)

    pay_q: dict = {
        "status": "COMPLETED",
        "payment_date": {"$gte": start_iso},
    }
    if end_iso:
        pay_q["payment_date"]["$lte"] = end_iso
    async for p in db.square_payments.find(pay_q, {"_id": 0}):
        amt = float(p.get("amount") or 0)
        if amt == 0:
            continue
        by_day[p["payment_date"]] = by_day.get(p["payment_date"], 0.0) + amt

    sale_q: dict = {
        "$and": [
            real_sales_mongo_filter(),
            {"sale_date": {"$gte": start_iso}},
            {
                "$or": [
                    {"square_transaction_id": None},
                    {"square_transaction_id": ""},
                    {"square_transaction_id": {"$exists": False}},
                ]
            },
        ]
    }
    if end_iso:
        sale_q["$and"].append({"sale_date": {"$lte": end_iso}})
    async for s in db.sales.find(sale_q, {"_id": 0, "sale_date": 1, "sale_price": 1}):
        d = s.get("sale_date") or ""
        if not d:
            continue
        by_day[d] = by_day.get(d, 0.0) + float(s.get("sale_price") or 0)

    return {k: round(v, 2) for k, v in by_day.items()}


async def find_real_sale_for_item(db, item_id: str) -> dict | None:
    """Most recent Square/manual sale for an item (ignores payout liabilities)."""
    if not item_id:
        return None
    async for s in db.sales.find({"item_id": item_id}, {"_id": 0}).sort(
        "created_at", -1
    ):
        if not is_liability_sale(s):
            return s
    return None


async def clear_liability_sales_for_item(db, item_id: str) -> int:
    """Drop expired-floor / opening owed rows once a real sale exists for the piece."""
    if not item_id:
        return 0
    result = await db.sales.delete_many(
        {
            "item_id": item_id,
            "payout_status": "Pending",
            "$or": [
                {"source": {"$in": list(LIABILITY_SOURCES)}},
                {"created_by": {"$in": list(LIABILITY_CREATED_BY)}},
                {
                    "notes": {
                        "$regex": r"^(Expired floor|Backfill from imported sold|Imported opening balance)"
                    }
                },
            ],
        }
    )
    return int(result.deleted_count or 0)


async def attach_square_transaction(
    db,
    sale: dict,
    *,
    square_transaction_id: str,
    sale_amount: float | None = None,
    note: str = "",
) -> dict:
    """Link a Square payment to an existing floor-logged sale — no second row."""
    tx_id = (square_transaction_id or "").strip()
    if not tx_id or not sale:
        return sale
    updates = {
        "square_transaction_id": tx_id,
        "source": "square",
    }
    notes = (sale.get("notes") or "").strip()
    if note and "Square" not in notes:
        updates["notes"] = f"{notes} · {note}".strip(" ·") if notes else note
    elif not notes and note:
        updates["notes"] = note
    # Keep floor-logged price unless the sale had no price
    if sale_amount is not None and float(sale.get("sale_price") or 0) <= 0:
        price = float(sale_amount)
        consignor = await db.consignors.find_one(
            {"consignor_id": sale.get("consignor_id")}, {"_id": 0}
        )
        item = await db.inventory.find_one({"item_id": sale.get("item_id")}, {"_id": 0})
        split_pct = resolve_consignor_split_pct(item or {}, consignor)
        store_cut, consignor_cut = split_sale_amount(price, split_pct)
        updates.update(
            {
                "sale_price": price,
                "store_cut": store_cut,
                "consignor_cut": consignor_cut,
                "consignor_split_pct": split_pct,
            }
        )
    await db.sales.update_one({"id": sale["id"]}, {"$set": updates})
    sale = {**sale, **updates}
    await clear_liability_sales_for_item(db, sale.get("item_id") or "")
    return sale


async def insert_pending_sale(
    db,
    *,
    item: dict,
    sale_price: float,
    notes: str = "",
    source: str = "",
    sale_date: str | None = None,
    created_by: str = "",
    mark_sold: bool = True,
) -> dict:
    """Create a pending payout sale. Optionally leave inventory status unchanged."""
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
        "square_transaction_id": None,
        "payout_status": "Pending",
        "payout_date": None,
        "payout_method": None,
        "notes": notes or "",
        "source": source or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": "",
        "created_by": created_by or "",
    }
    await db.sales.insert_one(doc)
    if mark_sold:
        await db.inventory.update_one(
            {"item_id": item["item_id"]},
            {"$set": {"status": "Sold", "date_sold": sale_date, "sale_price": price}},
        )
    doc.pop("_id", None)
    return doc


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
    item_id = item["item_id"]
    tx_id = (square_transaction_id or "").strip() or None

    # Same Square txn already recorded
    if tx_id:
        by_tx = await db.sales.find_one({"square_transaction_id": tx_id}, {"_id": 0})
        if by_tx and not is_liability_sale(by_tx):
            return by_tx

    # Floor already logged this piece — attach Square id instead of duplicating
    existing = await find_real_sale_for_item(db, item_id)
    if existing:
        if tx_id and not existing.get("square_transaction_id"):
            return await attach_square_transaction(
                db,
                existing,
                square_transaction_id=tx_id,
                sale_amount=float(sale_price),
                note=notes or "Square charge",
            )
        return existing

    consignor = await db.consignors.find_one(
        {"consignor_id": item["consignor_id"]}, {"_id": 0}
    )
    price = float(sale_price)
    split_pct = resolve_consignor_split_pct(item, consignor)
    store_cut, consignor_cut = split_sale_amount(price, split_pct)
    sale_date = sale_date or date.today().isoformat()
    source = "square" if tx_id else "manual"
    doc = {
        "id": str(uuid.uuid4()),
        "sale_date": sale_date,
        "item_id": item_id,
        "consignor_id": item["consignor_id"],
        "sale_price": price,
        "store_cut": store_cut,
        "consignor_cut": consignor_cut,
        "consignor_split_pct": split_pct,
        "square_transaction_id": tx_id,
        "payout_status": "Pending",
        "payout_date": None,
        "payout_method": None,
        "notes": notes or "",
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": operator_name or "",
        "created_by": created_by or "",
    }
    await db.sales.insert_one(doc)
    await db.inventory.update_one(
        {"item_id": item_id},
        {"$set": {"status": "Sold", "date_sold": sale_date, "sale_price": price}},
    )
    await clear_liability_sales_for_item(db, item_id)
    doc.pop("_id", None)
    return doc


async def upsert_opening_balance(
    db,
    *,
    consignor_id: str,
    amount: float,
    notes: str = "Imported opening balance",
    sale_date: str | None = None,
) -> dict | None:
    """Pending amount owed from cleanup / CSV import (amount = consignor cut)."""
    cut = round(float(amount), 2)
    if cut <= 0:
        return None
    consignor_id = str(consignor_id).strip()
    if not consignor_id:
        return None
    item_id = f"OPENING-{consignor_id}"
    sale_date = sale_date or date.today().isoformat()
    existing = await db.sales.find_one(
        {"item_id": item_id, "consignor_id": consignor_id}, {"_id": 0}
    )
    if existing:
        if existing.get("payout_status") == "Paid":
            return existing
        await db.sales.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "sale_price": cut,
                    "store_cut": 0.0,
                    "consignor_cut": cut,
                    "consignor_split_pct": 100.0,
                    "sale_date": sale_date,
                    "notes": notes,
                    "source": "import_opening_balance",
                }
            },
        )
        existing.update(
            {
                "sale_price": cut,
                "store_cut": 0.0,
                "consignor_cut": cut,
                "notes": notes,
            }
        )
        return existing

    doc = {
        "id": str(uuid.uuid4()),
        "sale_date": sale_date,
        "item_id": item_id,
        "consignor_id": consignor_id,
        "sale_price": cut,
        "store_cut": 0.0,
        "consignor_cut": cut,
        "consignor_split_pct": 100.0,
        "square_transaction_id": None,
        "payout_status": "Pending",
        "payout_date": None,
        "payout_method": None,
        "notes": notes,
        "source": "import_opening_balance",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": "",
        "created_by": "import",
    }
    await db.sales.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def backfill_sold_without_sales(db) -> int:
    """Sold inventory missing a sale row → pending payout (cleanup)."""
    created = 0
    async for item in db.inventory.find({"status": "Sold"}, {"_id": 0}):
        item_id = item.get("item_id")
        if not item_id:
            continue
        if await db.sales.find_one({"item_id": item_id}, {"_id": 1}):
            continue
        price = item.get("sale_price")
        if price is None or float(price or 0) <= 0:
            price = item.get("asking_price") or 0
        if float(price or 0) <= 0:
            continue
        await insert_sale(
            db,
            item=item,
            sale_price=float(price),
            notes="Backfill from imported sold item",
            sale_date=(item.get("date_sold") or item.get("date_in") or None),
            created_by="hygiene",
        )
        created += 1
    return created


async def backfill_expired_floor_sales(db) -> int:
    """Expired floor pieces (past ~60-day period) → pending consignor cut.

    Cleaning-house rule: imported Notion inventory that has aged past the
    consignment window still links to a consignor and should surface as owed
    until paid out or the piece is donated/returned.

    Skips boutique / house-owned stock (owner-bought, unassigned Notion ids).
    """
    from house_stock import is_house_consignor_id, is_house_item

    expired = await db.inventory.find(
        {"status": "Expired"},
        {"_id": 0},
    ).to_list(20000)
    if not expired:
        return 0
    ids = [i["item_id"] for i in expired if i.get("item_id")]
    existing = set(
        await db.sales.distinct("item_id", {"item_id": {"$in": ids}})
    )
    house_cids = set()
    async for c in db.consignors.find({}, {"_id": 0}):
        from house_stock import is_house_consignor

        if is_house_consignor(c):
            house_cids.add(c["consignor_id"])

    created = 0
    for item in expired:
        item_id = item.get("item_id")
        cid = item.get("consignor_id")
        if not item_id or item_id in existing:
            continue
        if (
            is_house_consignor_id(cid)
            or cid in house_cids
            or is_house_item(item)
        ):
            continue
        price = float(item.get("asking_price") or 0)
        if price <= 0:
            continue
        sale_date = item.get("period_end") or item.get("date_in") or date.today().isoformat()
        await insert_pending_sale(
            db,
            item=item,
            sale_price=price,
            notes="Expired floor — consignor cut on asking price",
            source="expired_floor",
            sale_date=str(sale_date)[:10],
            created_by="expired_backfill",
            mark_sold=False,
        )
        created += 1
    return created


async def cancel_pending_sales_for_items(db, item_ids: list[str]) -> int:
    """Donated / returned pieces are not owed — drop any pending payout rows."""
    if not item_ids:
        return 0
    result = await db.sales.delete_many(
        {
            "item_id": {"$in": list(item_ids)},
            "payout_status": "Pending",
        }
    )
    return int(result.deleted_count or 0)


# Back-compat alias
async def cancel_expired_floor_sales(db, item_ids: list[str]) -> int:
    return await cancel_pending_sales_for_items(db, item_ids)


async def scrub_donated_returned_pendings(db) -> int:
    """Remove pending sales tied to inventory already donated or returned."""
    ids = await db.inventory.distinct(
        "item_id", {"status": {"$in": ["Donated", "Returned"]}}
    )
    if not ids:
        return 0
    return await cancel_pending_sales_for_items(db, ids)
