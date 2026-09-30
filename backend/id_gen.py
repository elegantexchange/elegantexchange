"""Sequential ID generators using a counters collection.

Boutique convention:
- Consignors: 4-digit 2XXX (2001, 2002, …)
- Items: same consignor ID + sequence (2001-01, 2001-02, …)
  The boutique tag ID is the consignor number; the -NN keeps rows unique in-app.
"""

import re

_CONSIGNOR_ID_RE = re.compile(r"^2\d{3}$")


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


async def _highest_consignor_number(db) -> int:
    """Highest issued 2XXX id. House buckets (2999, HOUSE) do not count."""
    from house_stock import is_house_consignor_id

    highest = 2000
    async for row in db.consignors.find({}, {"_id": 0, "consignor_id": 1}):
        cid = (row.get("consignor_id") or "").strip()
        if not _CONSIGNOR_ID_RE.fullmatch(cid) or is_house_consignor_id(cid):
            continue
        highest = max(highest, int(cid))
    return highest


async def peek_next_consignor_id(db) -> str:
    """Next consignor id without reserving it, so a form can show it and still edit it."""
    from house_stock import is_house_consignor_id

    highest = await _highest_consignor_number(db)
    for n in range(highest + 1, highest + 5000):
        cid = str(n)
        if not _CONSIGNOR_ID_RE.fullmatch(cid) or is_house_consignor_id(cid):
            continue
        exists = await db.consignors.find_one({"consignor_id": cid}, {"_id": 1})
        if not exists:
            return cid
    raise RuntimeError("Could not allocate a free consignor id")


async def next_consignor_id(db) -> str:
    """Next consignor id, one past the highest number already on file.

    A gap from an older unused number is left alone. The counter is pulled
    forward when it sits behind the last consignor, then incremented.
    """
    highest = await _highest_consignor_number(db)
    await db.counters.update_one(
        {"_id": "consignor"},
        {"$max": {"seq": highest}},
        upsert=True,
    )
    for _ in range(5000):
        res = await db.counters.find_one_and_update(
            {"_id": "consignor"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        cid = str(int(res["seq"]))
        if not _CONSIGNOR_ID_RE.fullmatch(cid):
            break
        exists = await db.consignors.find_one({"consignor_id": cid}, {"_id": 1})
        if not exists:
            return cid
    raise RuntimeError("Could not allocate a free consignor id")


async def next_item_id(db, consignor_id: str) -> str:
    """Returns next item id for a consignor: {consignor_id}-{seq:02d}."""
    cid = (consignor_id or "").strip()
    if not cid:
        raise ValueError("consignor_id required for item id")
    key = f"item:{cid}"
    seq = await _bump(db, key, 0)
    return f"{cid}-{seq:02d}"
