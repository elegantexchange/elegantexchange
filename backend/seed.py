"""Seed demo data for The Elegant Exchange."""
import os
import random
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List

from auth import hash_password
from id_gen import next_item_id


async def seed_admin(db) -> None:
    from auth import migrate_user_roles, normalize_role

    await migrate_user_roles(db)

    admin_email = os.environ.get("ADMIN_EMAIL", "shop@elegantexchange.co").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "ElegantExchange2026!")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "name": admin_name,
                "role": "admin",
                "phone": "",
                "password_hash": hash_password(admin_password),
                "must_change_password": False,
                "onboarding_completed_at": now,
                "product_tour_completed_at": now,
                "created_at": now,
            }
        )
    else:
        updates = {"role": "admin", "name": admin_name}
        # Keep local/dev seed admin from being forced through onboarding/tour
        if not existing.get("onboarding_completed_at"):
            updates["onboarding_completed_at"] = now
            updates["must_change_password"] = False
        if not existing.get("product_tour_completed_at"):
            updates["product_tour_completed_at"] = now
        await db.users.update_one({"email": admin_email}, {"$set": updates})

    # Optional retail demo
    retail_email = "staff@elegantexchange.co"
    retail = await db.users.find_one({"email": retail_email})
    if not retail:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": retail_email,
                "name": "Floor Retail",
                "role": "retail",
                "phone": "",
                "password_hash": hash_password("Staff2026!"),
                "must_change_password": False,
                "onboarding_completed_at": now,
                "product_tour_completed_at": now,
                "created_at": now,
            }
        )
    elif normalize_role(retail.get("role")) in ("staff", "retail"):
        await db.users.update_one(
            {"email": retail_email},
            {"$set": {"role": "retail"}},
        )

    # Optional manager demo
    manager_email = "manager@elegantexchange.co"
    if not await db.users.find_one({"email": manager_email}):
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": manager_email,
                "name": "Floor Manager",
                "role": "manager",
                "phone": "",
                "password_hash": hash_password("Manager2026!"),
                "must_change_password": False,
                "onboarding_completed_at": now,
                "product_tour_completed_at": now,
                "created_at": now,
            }
        )


async def seed_demo(db) -> None:
    """Seed boutique-style mock data. Consignor IDs are 4-digit 2XXX."""
    # If we already have consignors, skip.
    if await db.consignors.count_documents({}) > 0:
        return

    today = date.today()
    random.seed(7)

    # Explicit boutique IDs (2XXX) — matches floor tags / Notion
    consignor_seed = [
        ("2001", "Margot Reynolds", "508-555-0142", "margot.r@example.com", "12 Elm St, Bridgewater MA", "Zelle", "508-555-0142", "donate", "Venmo backup @margot-r"),
        ("2002", "Eleanor Park", "508-555-0177", "eleanor.park@example.com", "44 Spring Ln, Bridgewater MA", "Venmo", "@eleanor-park", "pick-up", ""),
        ("2003", "Vivian Chen", "508-555-0211", "vivian.c@example.com", "9 Oak Rd, Raynham MA", "Check", "Mail to home", "donate", ""),
        ("2004", "Theodora Blake", "617-555-0398", "theo.blake@example.com", "23 Maple Ave, Boston MA", "Cash", "", "pick-up", ""),
        ("2005", "Sasha Albright", "508-555-0420", "sasha@example.com", "77 Pine St, Bridgewater MA", "Store Credit", "", "donate", ""),
        ("2006", "Camille Dufresne", "508-555-0567", "camille.d@example.com", "5 River Rd, Easton MA", "Zelle", "camille.d@example.com", "1/4", "Prefers text"),
        ("2007", "Penelope Ortiz", "508-555-0688", "penny.o@example.com", "31 Cherry St, Bridgewater MA", "Venmo", "@penny-ortiz", "donate", ""),
        ("2008", "Ava Moreau", "508-555-0711", "ava.moreau@example.com", "18 School St, Bridgewater MA", "Venmo", "@ava-moreau", "pick-up", ""),
    ]

    items_seed = [
        ("Cream textured bag", "Handbags", "cream", "gold rack (1)", "OS"),
        ("Pink bag with gold chain", "Handbags", "pink", "gold rack (1)", "OS"),
        ("Black coach bag with floral pattern", "Handbags", "black", "gold rack (1)", "OS"),
        ("Silk wrap dress, blush", "Dresses", "blush", "mannequin", "M"),
        ("Black wool trench coat", "Outerwear", "black", "windows", "S"),
        ("Cashmere crewneck sweater", "Tops", "camel", "gold rack (2)", "M"),
        ("Designer leather riding boots", "Shoes", "brown", "shoes", "8"),
        ("Linen midi skirt, cream", "Dresses", "cream", "gold table", "6"),
        ("Pearl drop earrings", "Accessories", "cream", "accessories", "OS"),
        ("High-rise raw denim jeans", "Denim", "blue", "jeans rack", "28"),
        ("Striped Breton tee", "Tops", "navy", "gold rack (2)", "S"),
        ("Suede ankle boots, camel", "Shoes", "camel", "shoes", "7"),
        ("Wool blend blazer, navy", "Outerwear", "navy", "windows", "M"),
        ("Floral silk scarf", "Accessories", "multicolor", "accessories", "OS"),
        ("Embellished evening clutch", "Handbags", "black", "gold rack (1)", "OS"),
        ("Crepe blouse with bow", "Tops", "ivory", "gold rack (2)", "S"),
        ("Tailored trousers, ivory", "Bottoms", "ivory", "jeans rack", "6"),
        ("Pleated maxi dress, emerald", "Dresses", "green", "mannequin", "M"),
        ("Tortoiseshell sunglasses", "Accessories", "brown", "accessories", "OS"),
        ("Heeled mules, patent black", "Shoes", "black", "shoes", "8"),
        ("Light blue linen shirt", "Tops", "light blue", "gold rack (2)", "L"),
        ("Dark red wrap dress", "Dresses", "dark red", "gold table", "10"),
    ]
    conditions = ["Excellent", "Like New", "Very Good", "Good"]

    consignor_records = []
    for cid, full_name, phone, email, addr, method, details, expiry, notes in consignor_seed:
        drop_off = (today - timedelta(days=random.randint(5, 45))).isoformat()
        doc = {
            "id": str(uuid.uuid4()),
            "consignor_id": cid,
            "full_name": full_name,
            "phone": phone,
            "email": email.lower(),
            "address": addr,
            "payout_method": method,
            "payout_details": details,
            "notes": notes,
            "expiry_action": expiry,
            "date_of_drop_off": drop_off,
            "import_flags": [],
            "needs_review": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat(),
        }
        await db.consignors.insert_one(doc)
        consignor_records.append(doc)

    # Next auto-created consignor should be 2009
    await db.counters.update_one(
        {"_id": "consignor"},
        {"$set": {"seq": 2008}},
        upsert=True,
    )

    inventory_records: List[dict] = []
    for idx, (desc, cat, color, rack, size) in enumerate(items_seed):
        consignor = consignor_records[idx % len(consignor_records)]
        days_ago = random.randint(2, 65)
        date_in = (today - timedelta(days=days_ago)).isoformat()
        item_id = await next_item_id(db, consignor["consignor_id"])
        period_end = (date.fromisoformat(date_in) + timedelta(days=60)).isoformat()
        status = "Active"
        if date.fromisoformat(period_end) <= today:
            status = "Expired"
        asking = round(random.choice([14.95, 28, 38, 45, 58, 75, 95, 120, 145, 185]), 2)
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor["consignor_id"],
            "description": desc,
            "category": cat,
            "size": size,
            "condition": random.choice(conditions),
            "asking_price": asking,
            "date_in": date_in,
            "period_end": period_end,
            "status": status,
            "date_sold": None,
            "sale_price": None,
            "rack": rack,
            "color": color,
            "text_id": f"TXT-{consignor['consignor_id']}-{idx + 1:02d}",
            "media": [],
            "import_flags": [],
            "needs_review": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory.insert_one(doc)
        inventory_records.append(doc)

    # Sales: ~half of items sold across last 30 days
    sold_count = max(1, len(inventory_records) // 2)
    sold_items = random.sample(inventory_records, sold_count)
    for it in sold_items:
        days_ago = random.randint(0, 28)
        sale_date = (today - timedelta(days=days_ago)).isoformat()
        sale_price = round(it["asking_price"] * random.uniform(0.85, 1.05), 2)
        store_cut = round(sale_price * 0.5, 2)
        consignor_cut = round(sale_price - store_cut, 2)
        sale_doc = {
            "id": str(uuid.uuid4()),
            "sale_date": sale_date,
            "item_id": it["item_id"],
            "consignor_id": it["consignor_id"],
            "sale_price": sale_price,
            "store_cut": store_cut,
            "consignor_cut": consignor_cut,
            "square_transaction_id": None,
            "payout_status": "Pending",
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

    # One historical payout for consignor 2001
    first_consignor = "2001"
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
                "processed_by": os.environ.get(
                    "ADMIN_EMAIL", "shop@elegantexchange.co"
                ),
                "notes": "Initial payout",
                "sale_ids": [s["id"]],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
