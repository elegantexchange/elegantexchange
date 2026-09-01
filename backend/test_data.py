"""Helpers for scrubbing boutique test / demo consignors from live data."""

from __future__ import annotations

import re

# Names that must never appear as real consignors on live
TEST_CONSIGNOR_NAME_RE = re.compile(
    r"^\s*("
    r"tai(\s+faustin)?"
    r"|auto\s+id\s+skip\s+test(\s+\d+)?"
    r"|drop[\s_-]*off\s+test(\s+client)?"
    r"|test\s+(client|consignor|drop[\s_-]*off)"
    r")\s*$",
    re.I,
)


def is_test_consignor(doc: dict | None) -> bool:
    if not doc:
        return False
    name = doc.get("full_name") or ""
    return bool(TEST_CONSIGNOR_NAME_RE.match(name))


async def scrub_test_consignors(db) -> dict:
    """Delete test consignors and their inventory / sales / payouts / drop-offs."""
    test_ids: list[str] = []
    async for c in db.consignors.find({}, {"_id": 0, "consignor_id": 1, "full_name": 1}):
        if is_test_consignor(c) and c.get("consignor_id"):
            test_ids.append(c["consignor_id"])

    removed = {
        "consignors": 0,
        "inventory": 0,
        "sales": 0,
        "payouts": 0,
        "drop_offs": 0,
        "ids": test_ids,
    }
    if not test_ids:
        return removed

    removed["consignors"] = (
        await db.consignors.delete_many({"consignor_id": {"$in": test_ids}})
    ).deleted_count
    removed["inventory"] = (
        await db.inventory.delete_many({"consignor_id": {"$in": test_ids}})
    ).deleted_count
    removed["sales"] = (
        await db.sales.delete_many({"consignor_id": {"$in": test_ids}})
    ).deleted_count
    removed["payouts"] = (
        await db.payouts.delete_many({"consignor_id": {"$in": test_ids}})
    ).deleted_count
    removed["drop_offs"] = (
        await db.drop_offs.delete_many({"consignor_id": {"$in": test_ids}})
    ).deleted_count
    return removed
