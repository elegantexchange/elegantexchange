"""Payouts routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone, date
import uuid

from models import PayoutCreate
from auth import require_roles

router = APIRouter(prefix="/api/payouts", tags=["payouts"])


@router.get("/queue")
async def queue(request: Request, _u: dict = Depends(require_roles("admin"))):
    """Aggregated pending balance per consignor."""
    db = request.app.state.db
    # Keep expired statuses current so queue can surface expiry pressure
    today = date.today().isoformat()
    await db.inventory.update_many(
        {"status": "Active", "period_end": {"$lte": today}},
        {"$set": {"status": "Expired"}},
    )
    from house_stock import is_house_consignor, is_house_consignor_id

    expired_map: dict[str, int] = {}
    async for row in db.inventory.aggregate(
        [
            {"$match": {"status": "Expired"}},
            {"$group": {"_id": "$consignor_id", "n": {"$sum": 1}}},
        ]
    ):
        if row.get("_id"):
            expired_map[row["_id"]] = int(row.get("n") or 0)

    pipeline = [
        {"$match": {"payout_status": "Pending"}},
        {
            "$group": {
                "_id": "$consignor_id",
                "balance": {"$sum": "$consignor_cut"},
                "items_count": {"$sum": 1},
                "oldest_sale": {"$min": "$sale_date"},
            }
        },
        {"$sort": {"balance": -1}},
    ]
    rows = []
    async for r in db.sales.aggregate(pipeline):
        consignor_id = r["_id"]
        if not consignor_id or is_house_consignor_id(consignor_id):
            continue
        if float(r.get("balance") or 0) <= 0:
            continue
        c = await db.consignors.find_one({"consignor_id": consignor_id}, {"_id": 0})
        if not c or is_house_consignor(c):
            continue
        last_payout = await db.payouts.find_one(
            {"consignor_id": consignor_id}, sort=[("date_paid", -1)]
        )
        days_since = None
        if last_payout and last_payout.get("date_paid"):
            try:
                d = date.fromisoformat(last_payout["date_paid"][:10])
                days_since = (date.today() - d).days
            except Exception:
                pass
        expired_n = expired_map.get(consignor_id, 0)
        oldest = r.get("oldest_sale")
        days_pending = None
        if oldest:
            try:
                days_pending = (date.today() - date.fromisoformat(str(oldest)[:10])).days
            except Exception:
                days_pending = None
        rows.append(
            {
                "consignor_id": consignor_id,
                "full_name": c["full_name"],
                "balance_owed": round(r["balance"], 2),
                "items_sold": r["items_count"],
                "expired_items": expired_n,
                "payout_method": c.get("payout_method", ""),
                "payout_details": c.get("payout_details", ""),
                "days_since_last_payout": days_since,
                "oldest_sale": oldest,
                "days_pending": days_pending,
            }
        )
    return rows


@router.get("/history")
async def history(request: Request, _u: dict = Depends(require_roles("admin"))):
    db = request.app.state.db
    payouts = await db.payouts.find({}, {"_id": 0}).sort("date_paid", -1).to_list(5000)
    cids = list({p["consignor_id"] for p in payouts})
    cmap = {}
    async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
        cmap[c["consignor_id"]] = c["full_name"]
    for p in payouts:
        p["consignor_name"] = cmap.get(p["consignor_id"], "")
    return payouts


@router.post("")
async def process_payout(
    body: PayoutCreate, request: Request, owner: dict = Depends(require_roles("admin"))
):
    db = request.app.state.db
    # Get all pending sales for this consignor sorted by oldest first
    pending = await db.sales.find(
        {"consignor_id": body.consignor_id, "payout_status": "Pending"}, {"_id": 0}
    ).sort("sale_date", 1).to_list(1000)
    if not pending:
        raise HTTPException(status_code=400, detail="No pending sales for consignor")

    total_pending = sum(s["consignor_cut"] for s in pending)
    amount = float(body.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if amount > total_pending + 0.01:
        raise HTTPException(
            status_code=400, detail=f"Amount exceeds pending balance of ${total_pending:.2f}"
        )

    today = date.today().isoformat()
    # Mark sales as paid, oldest first, until we cover the amount
    remaining = amount
    paid_sale_ids = []
    for s in pending:
        if remaining <= 0.01:
            break
        if s["consignor_cut"] <= remaining + 0.01:
            await db.sales.update_one(
                {"id": s["id"]},
                {
                    "$set": {
                        "payout_status": "Paid",
                        "payout_date": today,
                        "payout_method": body.method,
                    }
                },
            )
            paid_sale_ids.append(s["id"])
            remaining -= s["consignor_cut"]

    payout_doc = {
        "id": str(uuid.uuid4()),
        "consignor_id": body.consignor_id,
        "amount": round(amount, 2),
        "method": body.method,
        "date_paid": today,
        "processed_by": owner["email"],
        "notes": body.notes or "",
        "sale_ids": paid_sale_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payouts.insert_one(payout_doc)
    payout_doc.pop("_id", None)
    return payout_doc
