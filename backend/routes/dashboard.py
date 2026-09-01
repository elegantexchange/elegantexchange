"""Dashboard routes."""
from fastapi import APIRouter, Depends, Request
from datetime import date, timedelta
from collections import defaultdict

from auth import get_current_user
from sale_ops import (
    backfill_expired_floor_sales,
    combined_daily_revenue,
    real_sales_mongo_filter,
    scrub_donated_returned_pendings,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(
    request: Request,
    period: str = "week",
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    today = date.today()

    # Keep expired floor → pending consignor cuts in sync (idempotent)
    from house_stock import (
        ensure_house_consignor,
        is_house_consignor,
        is_house_consignor_id,
        mark_legacy_unassigned_as_house,
    )

    await mark_legacy_unassigned_as_house(db)
    await ensure_house_consignor(db)
    await scrub_donated_returned_pendings(db)
    await backfill_expired_floor_sales(db)

    real_q = real_sales_mongo_filter()

    # Sales today = Square COMPLETED charges + floor logs without a Square txn
    days_for_today = await combined_daily_revenue(
        db, today.isoformat(), today.isoformat()
    )
    sales_today_total = float(days_for_today.get(today.isoformat(), 0.0))

    # Active items
    active_items = await db.inventory.count_documents({"status": "Active"})

    # Payouts owed (exclude house / boutique-owned)
    pending = await db.sales.find(
        {"payout_status": "Pending"},
        {"_id": 0, "consignor_cut": 1, "consignor_id": 1},
    ).to_list(50000)
    payouts_owed = round(
        sum(
            float(p["consignor_cut"])
            for p in pending
            if float(p.get("consignor_cut") or 0) > 0
            and not is_house_consignor_id(p.get("consignor_id"))
        ),
        2,
    )

    # Total consignors (exclude hidden house account)
    total_consignors = 0
    async for c in db.consignors.find({}, {"_id": 0, "consignor_id": 1, "full_name": 1, "is_house": 1, "ownership": 1}):
        if is_house_consignor(c) or is_house_consignor_id(c.get("consignor_id")):
            continue
        total_consignors += 1

    # Unsettled balances (pending consignor cuts) — Home Needs attention + Payouts owed
    pending_pipeline = [
        {"$match": {"payout_status": "Pending"}},
        {
            "$group": {
                "_id": "$consignor_id",
                "balance": {"$sum": "$consignor_cut"},
                "oldest": {"$min": "$sale_date"},
                "items": {"$sum": 1},
            }
        },
        {"$sort": {"balance": -1, "oldest": 1}},
    ]
    pending_balances = []
    async for r in db.sales.aggregate(pending_pipeline):
        cid = r.get("_id")
        if not cid or is_house_consignor_id(cid):
            continue
        if float(r.get("balance") or 0) <= 0:
            continue
        c = await db.consignors.find_one({"consignor_id": cid}, {"_id": 0})
        if not c or is_house_consignor(c):
            continue
        oldest = r.get("oldest")
        days_pending = None
        if oldest:
            try:
                days_pending = (today - date.fromisoformat(str(oldest)[:10])).days
            except Exception:
                days_pending = None
        pending_balances.append(
            {
                "consignor_id": cid,
                "full_name": c["full_name"],
                "balance": round(r["balance"], 2),
                "oldest": oldest,
                "days_pending": days_pending,
                "items": int(r.get("items") or 0),
            }
        )
    # Back-compat alias used by older clients
    stale_balances = [b for b in pending_balances if (b.get("days_pending") or 0) >= 14]

    # Raise inventory alert caps; UI scrolls instead of truncating to 5
    expiring_soon = []
    expired = []
    seven_days = (today + timedelta(days=7)).isoformat()
    async for item in db.inventory.find(
        {"status": "Active", "period_end": {"$lte": seven_days, "$gte": today.isoformat()}},
        {"_id": 0},
    ).sort("period_end", 1).limit(100):
        from house_stock import house_display_name

        c = await db.consignors.find_one({"consignor_id": item["consignor_id"]}, {"_id": 0})
        item["consignor_name"] = house_display_name(item, c, fallback="")
        expiring_soon.append(item)
    async for item in db.inventory.find(
        {"status": "Expired"}, {"_id": 0}
    ).sort("period_end", 1).limit(100):
        from house_stock import house_display_name

        c = await db.consignors.find_one({"consignor_id": item["consignor_id"]}, {"_id": 0})
        item["consignor_name"] = house_display_name(item, c, fallback="")
        expired.append(item)

    # Sales trend — Square charges + unmatched floor logs (no double-count)
    days = 7 if period == "week" else (30 if period == "month" else 90)
    start_iso = (today - timedelta(days=days * 2 - 1)).isoformat()
    by_day = await combined_daily_revenue(db, start_iso)
    # Build last `days` days
    this_period = []
    prev_period = []
    for i in range(days):
        d_cur = (today - timedelta(days=days - 1 - i)).isoformat()
        d_prev = (today - timedelta(days=2 * days - 1 - i)).isoformat()
        this_period.append({"day": d_cur, "amount": round(by_day.get(d_cur, 0), 2)})
        prev_period.append({"day": d_prev, "amount": round(by_day.get(d_prev, 0), 2)})

    # Recent activity — this calendar week only (Mon–today)
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    activity = []
    async for s in db.sales.find(
        {"$and": [real_q, {"sale_date": {"$gte": week_start}}]},
        {"_id": 0},
    ).sort("created_at", -1).limit(20):
        c = await db.consignors.find_one({"consignor_id": s["consignor_id"]}, {"_id": 0})
        activity.append(
            {
                "type": "sale",
                "ts": s.get("created_at", ""),
                # Boutique ID on the tag is the consignor number (2XXX)
                "label": f"Sale · {s['consignor_id']} · ${s['sale_price']:.2f}",
                "sub": (
                    f"{c['full_name']} · {s['item_id']}"
                    if c
                    else s["item_id"]
                ),
            }
        )
    # Cap new-consignor noise after bulk import (same preview budget as Needs attention)
    intake_n = 0
    async for c in db.consignors.find({}, {"_id": 0}).sort("created_at", -1).limit(40):
        if is_house_consignor(c) or is_house_consignor_id(c.get("consignor_id")):
            continue
        ts = c.get("created_at", "")
        if not ts or ts[:10] < week_start:
            continue
        if intake_n >= 5:
            break
        activity.append(
            {
                "type": "intake",
                "ts": ts,
                "label": f"New consignor · {c['consignor_id']}",
                "sub": c["full_name"],
            }
        )
        intake_n += 1
    async for p in db.payouts.find({}, {"_id": 0}).sort("created_at", -1).limit(20):
        ts = p.get("created_at", "")
        paid = p.get("date_paid") or ""
        if (not ts or ts[:10] < week_start) and (not paid or paid < week_start):
            continue
        c = await db.consignors.find_one({"consignor_id": p["consignor_id"]}, {"_id": 0})
        activity.append(
            {
                "type": "payout",
                "ts": ts or f"{paid}T12:00:00+00:00",
                "label": f"Payout · ${p['amount']:.2f} · {p['method']}",
                "sub": c["full_name"] if c else "",
            }
        )
    activity.sort(key=lambda x: x["ts"], reverse=True)
    activity = activity[:30]

    return {
        "sales_today": round(sales_today_total, 2),
        "active_items": active_items,
        "payouts_owed": payouts_owed,
        "total_consignors": total_consignors,
        "alerts": {
            "expiring_soon": expiring_soon,
            "expired": expired,
            "pending_balances": pending_balances,
            "stale_balances": stale_balances,
        },
        "trend": {
            "this": this_period,
            "previous": prev_period,
            "period": period,
        },
        "activity": activity,
    }
