"""Owner-only admin operations."""
from fastapi import APIRouter, Depends, Request

from auth import require_owner

router = APIRouter(prefix="/api/admin", tags=["admin"])

_BOUTIQUE_COLLECTIONS = (
    "consignors",
    "inventory",
    "sales",
    "payouts",
    "square_sync_log",
    "counters",
)


@router.post("/reset-boutique-data")
async def reset_boutique_data(request: Request, _u: dict = Depends(require_owner)):
    """Remove all consignor/inventory/sales data. Keeps users and Square connection."""
    db = request.app.state.db
    deleted = {}
    for name in _BOUTIQUE_COLLECTIONS:
        result = await db[name].delete_many({})
        deleted[name] = result.deleted_count
    return {"ok": True, "deleted": deleted}
