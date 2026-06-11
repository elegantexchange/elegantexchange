"""Sequential ID generator using a counters collection."""


async def next_consignor_id(db) -> str:
    """Returns next EE-### style id."""
    res = await db.counters.find_one_and_update(
        {"_id": "consignor"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"] if res else 1
    return f"EE-{seq:03d}"


async def next_item_id(db, _consignor_id: str) -> str:
    """Returns next EE-#### style id (global sequence)."""
    res = await db.counters.find_one_and_update(
        {"_id": "item"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"] if res else 1
    return f"EE-{seq:04d}"
