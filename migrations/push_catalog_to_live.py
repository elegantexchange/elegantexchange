#!/usr/bin/env python3
"""Push cleaned local catalog to a target Mongo (live Atlas) or via live admin API.

Usage (Atlas URI from Railway Variables → MONGO_URL):

  TARGET_MONGO_URL='mongodb+srv://...' \\
  TARGET_DB_NAME='elegantexchange' \\
  backend/.venv/bin/python migrations/push_catalog_to_live.py

Or via the live HTTP API (preferred if you have admin password):

  LIVE_API='https://elegantexchange.up.railway.app' \\
  ADMIN_EMAIL='shop@elegantexchange.co' \\
  ADMIN_PASSWORD='...' \\
  backend/.venv/bin/python migrations/push_catalog_to_live.py --via-api
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(ROOT / "backend" / ".env")

from categorize import capitalize_description, infer_category  # noqa: E402

TEST_NAME_RE = re.compile(r"^\s*(tai(\s+faustin)?)\s*$", re.I)
DROP_C_FLAGS = {"refreshed_from_notion"}
DROP_I_FLAGS = {"missing_rack", "restored_after_seed_cleanup"}


def clean_consignor(doc: dict) -> dict | None:
    d = {k: v for k, v in doc.items() if k != "_id"}
    if TEST_NAME_RE.match(d.get("full_name") or ""):
        return None
    flags = [f for f in (d.get("import_flags") or []) if f not in DROP_C_FLAGS]
    d["import_flags"] = flags
    d["needs_review"] = bool(flags)
    return d


def clean_item(doc: dict, skip_cids: set[str]) -> dict | None:
    d = {k: v for k, v in doc.items() if k != "_id"}
    if d.get("consignor_id") in skip_cids:
        return None
    desc = capitalize_description(d.get("description") or "")
    d["description"] = desc
    cat = infer_category(desc, d.get("rack") or "", d.get("category") or "")
    d["category"] = cat
    flags = [f for f in (d.get("import_flags") or []) if f not in DROP_I_FLAGS]
    if cat != "Other":
        flags = [f for f in flags if f not in ("missing_category", "unknown_category")]
    d["import_flags"] = flags
    d["needs_review"] = bool(flags)
    return d


async def load_local_catalog():
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    name = os.environ.get("DB_NAME", "elegantexchange")
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=8000)
    db = client[name]
    consignors = await db.consignors.find({}, {"_id": 0}).to_list(10000)
    inventory = await db.inventory.find({}, {"_id": 0}).to_list(20000)
    client.close()

    skip = {
        c["consignor_id"]
        for c in consignors
        if TEST_NAME_RE.match(c.get("full_name") or "")
    }
    c_out = []
    for c in consignors:
        cleaned = clean_consignor(c)
        if cleaned:
            c_out.append(cleaned)
    i_out = []
    for i in inventory:
        cleaned = clean_item(i, skip)
        if cleaned:
            i_out.append(cleaned)
    return c_out, i_out


async def push_mongo(consignors, inventory):
    url = os.environ.get("TARGET_MONGO_URL") or ""
    name = os.environ.get("TARGET_DB_NAME") or os.environ.get("DB_NAME") or "elegantexchange"
    if not url or "localhost" in url or "127.0.0.1" in url:
        raise SystemExit(
            "Set TARGET_MONGO_URL to your Atlas mongodb+srv:// URI from Railway Variables"
        )
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=20000)
    db = client[name]
    await client.admin.command("ping")
    print(f"Connected to target db={name}")
    for col in ("consignors", "inventory", "sales", "payouts", "drop_offs"):
        n = (await db[col].delete_many({})).deleted_count
        print(f"  cleared {col}: {n}")
    if consignors:
        await db.consignors.insert_many(consignors)
    if inventory:
        await db.inventory.insert_many(inventory)
    print(f"Inserted consignors={len(consignors)} inventory={len(inventory)}")
    # Ensure seed demo stays off — do not insert sales
    client.close()


def push_api(consignors, inventory):
    import urllib.request

    api = (os.environ.get("LIVE_API") or "https://elegantexchange.up.railway.app").rstrip(
        "/"
    )
    email = os.environ.get("ADMIN_EMAIL") or ""
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or not password:
        raise SystemExit("Set ADMIN_EMAIL and ADMIN_PASSWORD for --via-api")

    def req(method, path, data=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        body = None if data is None else json.dumps(data).encode()
        r = urllib.request.Request(
            f"{api}{path}", data=body, headers=headers, method=method
        )
        with urllib.request.urlopen(r, timeout=600) as resp:
            return json.load(resp)

    login = req(
        "POST",
        "/api/auth/login",
        {"email": email, "password": password},
    )
    token = login.get("token") or login.get("access_token")
    if not token:
        raise SystemExit(f"Login failed: {login}")
    print("Logged into live API")
    # chunk if needed — send all at once first
    result = req(
        "POST",
        "/api/admin/replace-catalog",
        {
            "consignors": consignors,
            "inventory": inventory,
            "clear_sales_payouts": True,
        },
        token=token,
    )
    print(result)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--via-api", action="store_true")
    parser.add_argument("--export", type=str, default="", help="Optional JSON export path")
    args = parser.parse_args()

    consignors, inventory = await load_local_catalog()
    print(f"Local cleaned catalog: consignors={len(consignors)} inventory={len(inventory)}")
    if args.export:
        Path(args.export).write_text(
            json.dumps({"consignors": consignors, "inventory": inventory})
        )
        print(f"Wrote {args.export}")

    if args.via_api:
        push_api(consignors, inventory)
    else:
        await push_mongo(consignors, inventory)


if __name__ == "__main__":
    asyncio.run(main())
