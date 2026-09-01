"""Boutique / house-owned stock — owner-bought pieces, not consignor payouts.

Notion import used consignor id 2999 ("Unassigned") for shop-owned goods.
Those must never create balance owed, appear in the consignors list, or the
payouts queue. Inventory and sales show them as "In House".
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

# Canonical account for owner-bought / boutique-owned inventory
HOUSE_CONSIGNOR_ID = "HOUSE"
HOUSE_DISPLAY_NAME = "In House"
# Legacy Notion bucket for unassigned / shop-owned rows
LEGACY_HOUSE_IDS = frozenset({"2999", "0", "HOUSE", "house", "boutique"})

_UNASSIGNED_NAME_RE = re.compile(
    r"^\s*(unassigned\b.*|boutique(\s*\(house\))?|house(\s*stock)?|shop(\s*owned)?|in\s*house)\s*$",
    re.I,
)


def is_house_consignor_id(consignor_id: str | None) -> bool:
    cid = (consignor_id or "").strip()
    if not cid:
        return False
    if cid.upper() == HOUSE_CONSIGNOR_ID:
        return True
    return cid in LEGACY_HOUSE_IDS or cid.lower() in {x.lower() for x in LEGACY_HOUSE_IDS}


def is_house_consignor(doc: dict | None) -> bool:
    if not doc:
        return False
    if doc.get("is_house") is True or (doc.get("ownership") or "").lower() == "house":
        return True
    if is_house_consignor_id(doc.get("consignor_id")):
        return True
    name = doc.get("full_name") or ""
    return bool(_UNASSIGNED_NAME_RE.match(name))


def is_house_item(item: dict | None, consignor: dict | None = None) -> bool:
    if not item and not consignor:
        return False
    if item and (
        item.get("is_house") is True
        or (item.get("ownership") or "").lower() == "house"
        or is_house_consignor_id(item.get("consignor_id"))
    ):
        return True
    return is_house_consignor(consignor)


def house_display_name(
    item: dict | None = None, consignor: dict | None = None, fallback: str = ""
) -> str:
    if is_house_item(item, consignor) or is_house_consignor(consignor):
        return HOUSE_DISPLAY_NAME
    if item and item.get("consignor_name"):
        return item["consignor_name"]
    if consignor and consignor.get("full_name"):
        return consignor["full_name"]
    return fallback or ""


async def ensure_house_consignor(db) -> dict:
    """Guarantee a single hidden HOUSE account for owner-bought intake."""
    existing = await db.consignors.find_one(
        {"consignor_id": HOUSE_CONSIGNOR_ID}, {"_id": 0}
    )
    updates = {
        "is_house": True,
        "ownership": "house",
        "consignor_split_pct": 0.0,
        "full_name": HOUSE_DISPLAY_NAME,
        "needs_review": False,
        "import_flags": [],
        "notes": "Owner-bought / boutique-owned stock — hidden from consignors list.",
    }
    if existing:
        await db.consignors.update_one(
            {"consignor_id": HOUSE_CONSIGNOR_ID}, {"$set": updates}
        )
        existing.update(updates)
        return existing

    doc = {
        "id": HOUSE_CONSIGNOR_ID,
        "consignor_id": HOUSE_CONSIGNOR_ID,
        "full_name": HOUSE_DISPLAY_NAME,
        "phone": "",
        "email": "",
        "address": "",
        "payout_method": "Cash",
        "payout_details": "",
        "notes": updates["notes"],
        "expiry_action": "",
        "date_of_drop_off": "",
        "import_flags": [],
        "needs_review": False,
        "is_house": True,
        "ownership": "house",
        "consignor_split_pct": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consignors.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def consolidate_house_stock(db) -> dict:
    """Merge legacy house ids (e.g. 2999) into HOUSE and remove duplicates."""
    await ensure_house_consignor(db)

    legacy_ids: list[str] = []
    async for c in db.consignors.find({}, {"_id": 0, "consignor_id": 1, "full_name": 1}):
        cid = c.get("consignor_id")
        if not cid or cid == HOUSE_CONSIGNOR_ID:
            continue
        if is_house_consignor(c) or is_house_consignor_id(cid):
            legacy_ids.append(cid)

    moved = {"inventory": 0, "sales": 0, "drop_offs": 0, "payouts": 0}
    if legacy_ids:
        for col in ("inventory", "sales", "drop_offs", "payouts"):
            moved[col] = (
                await db[col].update_many(
                    {"consignor_id": {"$in": legacy_ids}},
                    {
                        "$set": {
                            "consignor_id": HOUSE_CONSIGNOR_ID,
                            "is_house": True,
                            "ownership": "house",
                            "consignor_split_pct": 0.0,
                        }
                    },
                )
            ).modified_count

        await db.inventory.update_many(
            {"consignor_id": HOUSE_CONSIGNOR_ID},
            {
                "$set": {
                    "is_house": True,
                    "ownership": "house",
                    "consignor_split_pct": 0.0,
                }
            },
        )

        deleted = (
            await db.consignors.delete_many({"consignor_id": {"$in": legacy_ids}})
        ).deleted_count
    else:
        deleted = 0

    sales_removed = (
        await db.sales.delete_many(
            {
                "consignor_id": HOUSE_CONSIGNOR_ID,
                "payout_status": "Pending",
                "source": "expired_floor",
            }
        )
    ).deleted_count

    return {
        "legacy_ids": legacy_ids,
        "moved": moved,
        "deleted_consignors": deleted,
        "sales_removed": sales_removed,
    }


async def mark_legacy_unassigned_as_house(db) -> dict:
    """Back-compat: consolidate into a single HOUSE account."""
    return await consolidate_house_stock(db)
