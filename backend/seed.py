"""Seed demo data for The Elegant Exchange."""
import os
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List

from auth import hash_password
from id_gen import next_item_id


async def seed_admin(db) -> None:
    admin_email = os.environ.get("ADMIN_EMAIL", "shop@elegantexchange.co").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "ElegantExchange2026!")
    admin_name = os.environ.get("ADMIN_NAME", "Owner")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "name": admin_name,
                "role": "owner",
                "password_hash": hash_password(admin_password),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    elif (existing.get("role") or "").lower() != "owner":
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"role": "owner"}},
        )
    # Optional staff demo
    staff_email = "staff@elegantexchange.co"
    if not await db.users.find_one({"email": staff_email}):
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": staff_email,
                "name": "Floor Staff",
                "role": "staff",
                "password_hash": hash_password("Staff2026!"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )


async def _next_id(db, key: str) -> int:
    res = await db.counters.find_one_and_update(
        {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return res["seq"]


async def seed_demo(db) -> None:
    # If we already have consignors, skip.
    if await db.consignors.count_documents({}) > 0:
        return

    today = date.today()

    consignor_seed = [
        ("Margot Reynolds", "508-555-0142", "margot.r@example.com", "12 Elm St, Bridgewater MA", "Zelle", "508-555-0142"),
        ("Eleanor Park", "508-555-0177", "eleanor.park@example.com", "44 Spring Ln, Bridgewater MA", "Venmo", "@eleanor-park"),
        ("Vivian Chen", "508-555-0211", "vivian.c@example.com", "9 Oak Rd, Raynham MA", "Check", "Mail to home"),
        ("Theodora Blake", "617-555-0398", "theo.blake@example.com", "23 Maple Ave, Boston MA", "Cash", ""),
        ("Sasha Albright", "508-555-0420", "sasha@example.com", "77 Pine St, Bridgewater MA", "Store Credit", ""),
        ("Camille Dufresne", "508-555-0567", "camille.d@example.com", "5 River Rd, Easton MA", "Zelle", "camille.d@example.com"),
        ("Penelope Ortiz", "508-555-0688", "penny.o@example.com", "31 Cherry St, Bridgewater MA", "Venmo", "@penny-ortiz"),
    ]

    categories = ["Dresses", "Tops", "Outerwear", "Handbags", "Shoes", "Accessories", "Denim"]
    conditions = ["Excellent", "Like New", "Very Good", "Good"]
    sizes = ["XS", "S", "M", "L", "XL", "6", "8", "10", "OS"]
    items_seed = [
        ("Silk wrap dress, blush", "Dresses"),
        ("Black wool trench coat", "Outerwear"),
        ("Vintage Chanel quilted bag", "Handbags"),
        ("Cashmere crewneck sweater", "Tops"),
        ("Designer leather riding boots", "Shoes"),
        ("Linen midi skirt, cream", "Dresses"),
        ("Pearl drop earrings", "Accessories"),
        ("High-rise raw denim jeans", "Denim"),
        ("Striped Breton tee", "Tops"),
        ("Suede ankle boots, camel", "Shoes"),
        ("Wool blend blazer, navy", "Outerwear"),
        ("Floral silk scarf", "Accessories"),
        ("Embellished evening clutch", "Handbags"),
        ("Crepe blouse with bow", "Tops"),
        ("Tailored trousers, ivory", "Denim"),
        ("Pleated maxi dress, emerald", "Dresses"),
        ("Tortoiseshell sunglasses", "Accessories"),
        ("Heeled mules, patent black", "Shoes"),
    ]

    consignor_records = []
    for full_name, phone, email, addr, method, details in consignor_seed:
        seq = await _next_id(db, "consignor")
        cid = f"EE-{seq:03d}"
        doc = {
            "id": str(uuid.uuid4()),
            "consignor_id": cid,
            "full_name": full_name,
            "phone": phone,
            "email": email.lower(),
            "address": addr,
            "payout_method": method,
            "payout_details": details,
            "notes": "",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat(),
        }
        await db.consignors.insert_one(doc)
        consignor_records.append(doc)

    # Items: distribute across consignors, vary date_in
    import random
    random.seed(7)
    inventory_records: List[dict] = []
    for idx, (desc, cat) in enumerate(items_seed):
        consignor = consignor_records[idx % len(consignor_records)]
        days_ago = random.randint(2, 65)
        date_in = (today - timedelta(days=days_ago)).isoformat()
        item_id = await next_item_id(db, consignor["consignor_id"])
        period_end = (
            date.fromisoformat(date_in) + timedelta(days=60)
        ).isoformat()
        status = "Active"
        if date.fromisoformat(period_end) <= today:
            status = "Expired"
        asking = round(random.choice([28, 38, 45, 58, 75, 95, 120, 145, 185, 220]), 2)
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor["consignor_id"],
            "description": desc,
            "category": cat,
            "size": random.choice(sizes),
            "condition": random.choice(conditions),
            "asking_price": asking,
            "date_in": date_in,
            "period_end": period_end,
            "status": status,
            "date_sold": None,
            "sale_price": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory.insert_one(doc)
        inventory_records.append(doc)

    # Sales: ~40% of items sold across last 30 days
    sold_count = max(1, len(inventory_records) // 2)
    sold_items = random.sample(inventory_records, sold_count)
    for it in sold_items:
        days_ago = random.randint(0, 28)
        sale_date = (today - timedelta(days=days_ago)).isoformat()
        # Sale price within +/- 15% of asking
        sale_price = round(it["asking_price"] * random.uniform(0.85, 1.05), 2)
        store_cut = round(sale_price * 0.5, 2)
        consignor_cut = round(sale_price - store_cut, 2)
        payout_status = "Pending"
        sale_doc = {
            "id": str(uuid.uuid4()),
            "sale_date": sale_date,
            "item_id": it["item_id"],
            "consignor_id": it["consignor_id"],
            "sale_price": sale_price,
            "store_cut": store_cut,
            "consignor_cut": consignor_cut,
            "square_transaction_id": None,
            "payout_status": payout_status,
            "payout_date": None,
            "payout_method": None,
            "notes": "",
            "created_at": (
                datetime.now(timezone.utc) - timedelta(days=days_ago)
            ).isoformat(),
        }
        await db.sales.insert_one(sale_doc)
        await db.inventory.update_one(
            {"item_id": it["item_id"]},
            {
                "$set": {
                    "status": "Sold",
                    "date_sold": sale_date,
                    "sale_price": sale_price,
                }
            },
        )

    # Process one historical payout for the first consignor to demonstrate history
    first_consignor = consignor_records[0]["consignor_id"]
    paid_sales = await db.sales.find(
        {"consignor_id": first_consignor, "payout_status": "Pending"}
    ).limit(1).to_list(1)
    if paid_sales:
        s = paid_sales[0]
        paid_date = (today - timedelta(days=5)).isoformat()
        await db.sales.update_one(
            {"id": s["id"]},
            {
                "$set": {
                    "payout_status": "Paid",
                    "payout_date": paid_date,
                    "payout_method": "Zelle",
                }
            },
        )
        await db.payouts.insert_one(
            {
                "id": str(uuid.uuid4()),
                "consignor_id": first_consignor,
                "amount": s["consignor_cut"],
                "method": "Zelle",
                "date_paid": paid_date,
                "processed_by": os.environ.get("ADMIN_EMAIL", "info@elegantexchange.co"),
                "notes": "Initial payout",
                "sale_ids": [s["id"]],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
