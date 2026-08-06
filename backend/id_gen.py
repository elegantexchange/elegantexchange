"""Sequential ID generators using a counters collection.

Boutique convention:
- Consignors: 4-digit 2XXX (2001, 2002, …)
- Items: same consignor ID + sequence (2001-01, 2001-02, …)
  The boutique tag ID is the consignor number; the -NN keeps rows unique in-app.
"""


async def _bump(db, key: str, floor: int) -> int:
    """Increment counter, ensuring it never starts below floor."""
    doc = await db.counters.find_one({"_id": key})
    if not doc or int(doc.get("seq") or 0) < floor:
        await db.counters.update_one(
            {"_id": key},
            {"$set": {"seq": floor}},
            upsert=True,
        )
    res = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        return_document=True,
    )
    return int(res["seq"])


async def next_consignor_id(db) -> str:
    """Returns next 4-digit boutique consignor id (2XXX)."""
    return str(await _bump(db, "consignor", 2000))


async def next_item_id(db, consignor_id: str) -> str:
    """Returns next item id for a consignor: {consignor_id}-{seq:02d}."""
    cid = (consignor_id or "").strip()
    if not cid:
        raise ValueError("consignor_id required for item id")
    key = f"item:{cid}"
    seq = await _bump(db, key, 0)
    return f"{cid}-{seq:02d}"
