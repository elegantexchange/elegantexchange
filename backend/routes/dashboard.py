"""Dashboard routes."""
from fastapi import APIRouter, Depends, Request
from datetime import date, timedelta
from collections import defaultdict

from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(
    request: Request,
    period: str = "week",
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    today = date.today()

    # Sales today
    today_sales_cursor = db.sales.find({"sale_date": today.isoformat()}, {"_id": 0})
    sales_today_total = 0.0
    async for s in today_sales_cursor:
        sales_today_total += s["sale_price"]

    # Active items
    active_items = await db.inventory.count_documents({"status": "Active"})

    # Payouts owed
    pending = await db.sales.find(
        {"payout_status": "Pending"}, {"_id": 0, "consignor_cut": 1}
    ).to_list(50000)
    payouts_owed = round(sum(p["consignor_cut"] for p in pending), 2)

    # Total consignors
    total_consignors = await db.consignors.count_documents({})

    # Alerts
    expiring_soon = []
    expired = []
    seven_days = (today + timedelta(days=7)).isoformat()
    async for item in db.inventory.find(
        {"status": "Active", "period_end": {"$lte": seven_days, "$gte": today.isoformat()}},
        {"_id": 0},
    ).sort("period_end", 1).limit(20):
        c = await db.consignors.find_one({"consignor_id": item["consignor_id"]}, {"_id": 0})
        item["consignor_name"] = c["full_name"] if c else ""
        expiring_soon.append(item)
    async for item in db.inventory.find(
        {"status": "Expired"}, {"_id": 0}
    ).sort("period_end", 1).limit(20):
        c = await db.consignors.find_one({"consignor_id": item["consignor_id"]}, {"_id": 0})
        item["consignor_name"] = c["full_name"] if c else ""
        expired.append(item)

    # Unpaid balances > 14 days
    cutoff = (today - timedelta(days=14)).isoformat()
    stale_pipeline = [
        {"$match": {"payout_status": "Pending", "sale_date": {"$lte": cutoff}}},
        {
            "$group": {
                "_id": "$consignor_id",
                "balance": {"$sum": "$consignor_cut"},
                "oldest": {"$min": "$sale_date"},
            }
        },
        {"$sort": {"balance": -1}},
        {"$limit": 20},
    ]
    stale_balances = []
    async for r in db.sales.aggregate(stale_pipeline):
        c = await db.consignors.find_one({"consignor_id": r["_id"]}, {"_id": 0})
        if c:
            stale_balances.append(
                {
                    "consignor_id": r["_id"],
                    "full_name": c["full_name"],
                    "balance": round(r["balance"], 2),
                    "oldest": r["oldest"],
                }
            )

    # Sales trend
    days = 7 if period == "week" else (30 if period == "month" else 90)
    start_iso = (today - timedelta(days=days * 2 - 1)).isoformat()
    trend_sales = await db.sales.find(
        {"sale_date": {"$gte": start_iso}}, {"_id": 0, "sale_date": 1, "sale_price": 1}
    ).to_list(50000)
    by_day = defaultdict(float)
    for s in trend_sales:
        by_day[s["sale_date"]] += s["sale_price"]
    # Build last `days` days
    this_period = []
    prev_period = []
    for i in range(days):
        d_cur = (today - timedelta(days=days - 1 - i)).isoformat()
        d_prev = (today - timedelta(days=2 * days - 1 - i)).isoformat()
        this_period.append({"day": d_cur, "amount": round(by_day.get(d_cur, 0), 2)})
        prev_period.append({"day": d_prev, "amount": round(by_day.get(d_prev, 0), 2)})

    # Recent activity (sales, intakes, payouts)
    activity = []
    async for s in db.sales.find({}, {"_id": 0}).sort("created_at", -1).limit(8):
        c = await db.consignors.find_one({"consignor_id": s["consignor_id"]}, {"_id": 0})
        activity.append(
            {
                "type": "sale",
                "ts": s.get("created_at", ""),
                "label": f"Sale · {s['item_id']} · ${s['sale_price']:.2f}",
                "sub": c["full_name"] if c else "",
            }
        )
    async for c in db.consignors.find({}, {"_id": 0}).sort("created_at", -1).limit(5):
        activity.append(
            {
                "type": "intake",
                "ts": c.get("created_at", ""),
                "label": f"New consignor · {c['consignor_id']}",
                "sub": c["full_name"],
            }
        )
    async for p in db.payouts.find({}, {"_id": 0}).sort("created_at", -1).limit(5):
        c = await db.consignors.find_one({"consignor_id": p["consignor_id"]}, {"_id": 0})
        activity.append(
            {
                "type": "payout",
                "ts": p.get("created_at", ""),
                "label": f"Payout · ${p['amount']:.2f} · {p['method']}",
                "sub": c["full_name"] if c else "",
            }
        )
    activity.sort(key=lambda x: x["ts"], reverse=True)
    activity = activity[:10]

    return {
        "sales_today": round(sales_today_total, 2),
        "active_items": active_items,
        "payouts_owed": payouts_owed,
        "total_consignors": total_consignors,
        "alerts": {
            "expiring_soon": expiring_soon,
            "expired": expired,
            "stale_balances": stale_balances,
        },
        "trend": {
            "this": this_period,
            "previous": prev_period,
            "period": period,
        },
        "activity": activity,
    }
