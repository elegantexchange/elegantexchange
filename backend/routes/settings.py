"""Boutique settings routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import get_current_user, require_roles
from boutique_settings import add_discount, get_settings, remove_discount, set_consignor_split_pct

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SplitUpdate(BaseModel):
    consignor_split_pct: float = Field(..., ge=0, le=100)


class DiscountCreate(BaseModel):
    category: str
    percent_off: float = Field(..., gt=0, le=90)
    starts_on: str
    ends_on: str


@router.get("")
async def read_settings(request: Request, _u: dict = Depends(get_current_user)):
    return await get_settings(request.app.state.db)


@router.put("/split")
async def update_split(
    body: SplitUpdate,
    request: Request,
    _o: dict = Depends(require_roles("admin")),
):
    try:
        return await set_consignor_split_pct(
            request.app.state.db, body.consignor_split_pct
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/discounts")
async def create_discount(
    body: DiscountCreate,
    request: Request,
    _o: dict = Depends(require_roles("admin")),
):
    try:
        return await add_discount(
            request.app.state.db,
            body.category,
            body.percent_off,
            body.starts_on,
            body.ends_on,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/discounts/{discount_id}")
async def delete_discount(
    discount_id: str,
    request: Request,
    _o: dict = Depends(require_roles("admin")),
):
    try:
        return await remove_discount(request.app.state.db, discount_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
