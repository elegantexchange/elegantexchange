"""Analytics routes."""
from fastapi import APIRouter, Depends, Request
from datetime import date, timedelta
from collections import defaultdict

from auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _range_start(period: str) -> str | None:
    today = date.today()
    if period == "today":
        return today.isoformat()
    if period == "week":
        return (today - timedelta(days=today.weekday())).isoformat()
    if period == "month":
        return today.replace(day=1).isoformat()
    return None  # all time


@router.get("")
async def get_analytics(
    request: Request,
    period: str = "month",
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    start = _range_start(period)
    sales_q = {} if start is None else {"sale_date": {"$gte": start}}
    sales = await db.sales.find(sales_q, {"_id": 0}).to_list(50000)

    total_sales = sum(s["sale_price"] for s in sales)
    store_revenue = sum(s["store_cut"] for s in sales)
    items_sold = len(sales)
    avg_price = round(total_sales / items_sold, 2) if items_sold else 0

    # Daily trend
    daily = defaultdict(float)
    for s in sales:
        daily[s["sale_date"]] += s["sale_price"]
    trend = [{"date": d, "amount": round(v, 2)} for d, v in sorted(daily.items())]

    # Revenue by category (need to join inventory)
    item_ids = list({s["item_id"] for s in sales})
    cat_map = {}
    async for i in db.inventory.find({"item_id": {"$in": item_ids}}, {"_id": 0}):
        cat_map[i["item_id"]] = i.get("category", "Other")
    by_cat = defaultdict(float)
    for s in sales:
        by_cat[cat_map.get(s["item_id"], "Other")] += s["sale_price"]
    revenue_by_category = [
        {"category": k, "amount": round(v, 2)} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])
    ]

    # Inventory metrics
    inventory = await db.inventory.find({}, {"_id": 0}).to_list(50000)
    active_by_cat = defaultdict(int)
    sold_count = 0
    total_consigned = len(inventory)
    days_to_sell_list = []
    today = date.today()
    expiring_soon = 0
    for i in inventory:
        if i["status"] == "Active":
            active_by_cat[i.get("category", "Other")] += 1
            try:
                pe = date.fromisoformat(i["period_end"])
                if (pe - today).days <= 7 and (pe - today).days >= 0:
                    expiring_soon += 1
            except Exception:
                pass
        if i["status"] == "Sold":
            sold_count += 1
            try:
                di = date.fromisoformat(i["date_in"])
                ds = date.fromisoformat(i["date_sold"]) if i.get("date_sold") else None
                if ds:
                    days_to_sell_list.append((ds - di).days)
            except Exception:
                pass
    sell_through = round((sold_count / total_consigned) * 100, 1) if total_consigned else 0
    avg_days = round(sum(days_to_sell_list) / len(days_to_sell_list), 1) if days_to_sell_list else 0
    active_by_category = [
        {"category": k, "count": v} for k, v in sorted(active_by_cat.items(), key=lambda x: -x[1])
    ]

    # Top consignors
    consignor_rev = defaultdict(float)
    consignor_items = defaultdict(int)
    for s in sales:
        consignor_rev[s["consignor_id"]] += s["sale_price"]
        consignor_items[s["consignor_id"]] += 1
    cids = list(consignor_rev.keys())
    cmap = {}
    async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
        cmap[c["consignor_id"]] = c["full_name"]
    top_consignors_revenue = sorted(
        [
            {
                "consignor_id": cid,
                "name": cmap.get(cid, cid),
                "revenue": round(rev, 2),
                "items": consignor_items[cid],
            }
            for cid, rev in consignor_rev.items()
        ],
        key=lambda x: -x["revenue"],
    )[:10]

    # Payout obligations
    all_pending = await db.sales.find(
        {"payout_status": "Pending"}, {"_id": 0, "consignor_cut": 1}
    ).to_list(50000)
    pending_obligations = round(sum(p["consignor_cut"] for p in all_pending), 2)
    all_paid = await db.payouts.find({}, {"_id": 0, "amount": 1}).to_list(50000)
    total_paid_out = round(sum(p["amount"] for p in all_paid), 2)

    return {
        "period": period,
        "total_sales": round(total_sales, 2),
        "store_revenue": round(store_revenue, 2),
        "items_sold": items_sold,
        "avg_sale_price": avg_price,
        "trend": trend,
        "revenue_by_category": revenue_by_category,
        "active_by_category": active_by_category,
        "sell_through_rate": sell_through,
        "avg_days_to_sell": avg_days,
        "expiring_soon": expiring_soon,
        "top_consignors": top_consignors_revenue,
        "pending_obligations": pending_obligations,
        "total_paid_out": total_paid_out,
    }
