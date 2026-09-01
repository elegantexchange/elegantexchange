"""Owner-only admin operations."""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import require_roles
from categorize import capitalize_description, infer_category

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Never touch `users` — admin/manager/retail logins and roles live there.
_BOUTIQUE_COLLECTIONS = (
    "consignors",
    "inventory",
    "sales",
    "payouts",
    "square_sync_log",
    "counters",
    "drop_offs",
)

_DROP_CONSIGNOR_FLAGS = {
    "refreshed_from_notion",
}
_DROP_INVENTORY_FLAGS = {
    "missing_rack",
    "restored_after_seed_cleanup",
}
_TEST_NAME_RE = re.compile(r"^\s*(tai(\s+faustin)?)\s*$", re.I)


@router.post("/reset-boutique-data")
async def reset_boutique_data(request: Request, _u: dict = Depends(require_roles("admin"))):
    """Remove all consignor/inventory/sales data. Keeps users and Square connection."""
    db = request.app.state.db
    deleted = {}
    for name in _BOUTIQUE_COLLECTIONS:
        result = await db[name].delete_many({})
        deleted[name] = result.deleted_count
    return {"ok": True, "deleted": deleted}


@router.post("/hygiene")
async def boutique_hygiene(request: Request, _u: dict = Depends(require_roles("admin"))):
    """Clean test accounts, stale import flags, capitalize descriptions, smart-categorize."""
    db = request.app.state.db

    # --- remove test consignors (Tai / Tai Faustin) and related rows ---
    test_ids: list[str] = []
    async for c in db.consignors.find({}, {"_id": 0, "consignor_id": 1, "full_name": 1}):
        if _TEST_NAME_RE.match(c.get("full_name") or ""):
            test_ids.append(c["consignor_id"])

    removed = {
        "consignors": 0,
        "inventory": 0,
        "sales": 0,
        "payouts": 0,
        "drop_offs": 0,
    }
    if test_ids:
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

    # --- consignors: drop intentional/non-flags ---
    consignor_flag_clears = 0
    async for c in db.consignors.find({}, {"_id": 1, "import_flags": 1}):
        flags = [f for f in (c.get("import_flags") or []) if f not in _DROP_CONSIGNOR_FLAGS]
        if flags != (c.get("import_flags") or []):
            await db.consignors.update_one(
                {"_id": c["_id"]},
                {"$set": {"import_flags": flags, "needs_review": bool(flags)}},
            )
            consignor_flag_clears += 1

    # --- inventory: flags, capitalize, categorize ---
    inv_updated = 0
    categorized = 0
    capitalized = 0
    async for item in db.inventory.find({}):
        desc = item.get("description") or ""
        new_desc = capitalize_description(desc)
        cat = infer_category(new_desc, item.get("rack") or "", item.get("category") or "")
        flags = [
            f
            for f in (item.get("import_flags") or [])
            if f not in _DROP_INVENTORY_FLAGS
        ]
        # If we now have a real category, drop missing/unknown category flags
        if cat != "Other":
            flags = [f for f in flags if f not in ("missing_category", "unknown_category")]

        patch: dict[str, Any] = {}
        if new_desc != desc:
            patch["description"] = new_desc
            capitalized += 1
        if cat != (item.get("category") or ""):
            patch["category"] = cat
            categorized += 1
        if flags != (item.get("import_flags") or []):
            patch["import_flags"] = flags
            patch["needs_review"] = bool(flags)
        elif bool(flags) != bool(item.get("needs_review")):
            patch["needs_review"] = bool(flags)

        if patch:
            await db.inventory.update_one({"_id": item["_id"]}, {"$set": patch})
            inv_updated += 1

    return {
        "ok": True,
        "removed_test": removed,
        "consignor_flag_clears": consignor_flag_clears,
        "inventory_updated": inv_updated,
        "descriptions_capitalized": capitalized,
        "categorized": categorized,
    }


class CatalogReplace(BaseModel):
    """Replace boutique catalog (keeps users). Used to push Notion data to live."""

    consignors: list[dict[str, Any]] = Field(default_factory=list)
    inventory: list[dict[str, Any]] = Field(default_factory=list)
    clear_sales_payouts: bool = True


@router.post("/replace-catalog")
async def replace_catalog(
    body: CatalogReplace,
    request: Request,
    _u: dict = Depends(require_roles("admin")),
):
    """Wipe consignors/inventory (and optionally sales/payouts) then insert provided docs."""
    if not body.consignors and not body.inventory:
        raise HTTPException(status_code=400, detail="No catalog data provided")

    db = request.app.state.db
    deleted = {
        "consignors": (await db.consignors.delete_many({})).deleted_count,
        "inventory": (await db.inventory.delete_many({})).deleted_count,
        "drop_offs": (await db.drop_offs.delete_many({})).deleted_count,
    }
    if body.clear_sales_payouts:
        deleted["sales"] = (await db.sales.delete_many({})).deleted_count
        deleted["payouts"] = (await db.payouts.delete_many({})).deleted_count

    # Strip Mongo _id; re-apply hygiene on write
    consignor_docs = []
    for raw in body.consignors:
        doc = {k: v for k, v in raw.items() if k != "_id"}
        if _TEST_NAME_RE.match(doc.get("full_name") or ""):
            continue
        flags = [
            f
            for f in (doc.get("import_flags") or [])
            if f not in _DROP_CONSIGNOR_FLAGS
        ]
        doc["import_flags"] = flags
        doc["needs_review"] = bool(flags)
        consignor_docs.append(doc)

    inventory_docs = []
    skip_cids = {
        c["consignor_id"]
        for c in consignor_docs
        if _TEST_NAME_RE.match(c.get("full_name") or "")
    }
    # Also skip inventory for test names that were filtered out of consignors list
    test_cids_from_payload = set()
    for raw in body.consignors:
        if _TEST_NAME_RE.match((raw or {}).get("full_name") or ""):
            if raw.get("consignor_id"):
                test_cids_from_payload.add(raw["consignor_id"])

    for raw in body.inventory:
        doc = {k: v for k, v in raw.items() if k != "_id"}
        if doc.get("consignor_id") in test_cids_from_payload or doc.get("consignor_id") in skip_cids:
            continue
        desc = capitalize_description(doc.get("description") or "")
        doc["description"] = desc
        cat = infer_category(desc, doc.get("rack") or "", doc.get("category") or "")
        doc["category"] = cat
        flags = [
            f
            for f in (doc.get("import_flags") or [])
            if f not in _DROP_INVENTORY_FLAGS
        ]
        if cat != "Other":
            flags = [f for f in flags if f not in ("missing_category", "unknown_category")]
        doc["import_flags"] = flags
        doc["needs_review"] = bool(flags)
        inventory_docs.append(doc)

    if consignor_docs:
        await db.consignors.insert_many(consignor_docs)
    if inventory_docs:
        await db.inventory.insert_many(inventory_docs)

    return {
        "ok": True,
        "deleted": deleted,
        "inserted": {
            "consignors": len(consignor_docs),
            "inventory": len(inventory_docs),
        },
    }
