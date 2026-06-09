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


async def next_item_id(db, consignor_id: str) -> str:
    """Returns EE-001-01 style id, scoped to the consignor."""
    res = await db.counters.find_one_and_update(
        {"_id": f"item:{consignor_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"] if res else 1
    return f"{consignor_id}-{seq:02d}"
