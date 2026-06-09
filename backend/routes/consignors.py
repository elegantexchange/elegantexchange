"""Consignor routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
import uuid

from models import ConsignorCreate, ConsignorUpdate
from auth import get_current_user
from id_gen import next_consignor_id

router = APIRouter(prefix="/api/consignors", tags=["consignors"])


async def _balance_for(db, consignor_id: str) -> float:
    cursor = db.sales.find(
        {"consignor_id": consignor_id, "payout_status": "Pending"},
        {"_id": 0, "consignor_cut": 1},
    )
    total = 0.0
    async for s in cursor:
        total += float(s.get("consignor_cut", 0))
    return round(total, 2)


async def _active_count(db, consignor_id: str) -> int:
    return await db.inventory.count_documents(
        {"consignor_id": consignor_id, "status": "Active"}
    )


@router.get("")
async def list_consignors(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    consignors = await db.consignors.find({}, {"_id": 0}).to_list(5000)
    for c in consignors:
        c["active_items"] = await _active_count(db, c["consignor_id"])
        c["total_owed"] = await _balance_for(db, c["consignor_id"])
    return consignors


@router.post("")
async def create_consignor(
    body: ConsignorCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    cid = await next_consignor_id(db)
    doc = {
        "id": str(uuid.uuid4()),
        "consignor_id": cid,
        "full_name": body.full_name,
        "phone": body.phone or "",
        "email": (body.email or "").lower(),
        "address": body.address or "",
        "payout_method": body.payout_method,
        "payout_details": body.payout_details or "",
        "notes": body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consignors.insert_one(doc)
    doc.pop("_id", None)
    doc["active_items"] = 0
    doc["total_owed"] = 0.0
    return doc


@router.get("/{consignor_id}")
async def get_consignor(
    consignor_id: str, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    c = await db.consignors.find_one({"consignor_id": consignor_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c["active_items"] = await _active_count(db, consignor_id)
    c["total_owed"] = await _balance_for(db, consignor_id)
    c["items"] = await db.inventory.find(
        {"consignor_id": consignor_id}, {"_id": 0}
    ).sort("date_in", -1).to_list(2000)
    c["sales"] = await db.sales.find(
        {"consignor_id": consignor_id}, {"_id": 0}
    ).sort("sale_date", -1).to_list(2000)
    c["payouts"] = await db.payouts.find(
        {"consignor_id": consignor_id}, {"_id": 0}
    ).sort("date_paid", -1).to_list(1000)
    return c


@router.patch("/{consignor_id}")
async def update_consignor(
    consignor_id: str,
    body: ConsignorUpdate,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True}
    await db.consignors.update_one({"consignor_id": consignor_id}, {"$set": updates})
    return {"ok": True}


@router.delete("/{consignor_id}")
async def delete_consignor(
    consignor_id: str, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    count = await db.inventory.count_documents({"consignor_id": consignor_id})
    if count > 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete consignor with inventory"
        )
    await db.consignors.delete_one({"consignor_id": consignor_id})
    return {"ok": True}


@router.post("/{consignor_id}/agreement")
async def save_agreement(
    consignor_id: str,
    body: dict,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    """Store the signed agreement (signature data URL + timestamp + agreement text snapshot)."""
    db = request.app.state.db
    c = await db.consignors.find_one({"consignor_id": consignor_id})
    if not c:
        raise HTTPException(status_code=404, detail="Consignor not found")
    sig = body.get("signature_data_url")
    if not sig or not sig.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Missing or invalid signature")
    doc = {
        "signature_data_url": sig,
        "agreement_text": body.get("agreement_text", ""),
        "signed_name": body.get("signed_name", c["full_name"]),
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "signed_by_staff": _u.get("email", ""),
    }
    await db.consignors.update_one(
        {"consignor_id": consignor_id}, {"$set": {"agreement": doc}}
    )
    return {"ok": True, "agreement": doc}


@router.get("/{consignor_id}/agreement.pdf")
async def download_agreement_pdf(
    consignor_id: str, request: Request, _u: dict = Depends(get_current_user)
):
    from fastapi.responses import Response
    from agreement_pdf import render_agreement_pdf

    db = request.app.state.db
    c = await db.consignors.find_one({"consignor_id": consignor_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Consignor not found")
    if not c.get("agreement"):
        raise HTTPException(status_code=404, detail="No signed agreement on file")
    pdf_bytes = render_agreement_pdf(c)
    filename = f"{consignor_id}-consignment-agreement.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
