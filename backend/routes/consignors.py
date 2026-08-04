"""Consignor routes."""
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from datetime import datetime, timezone
import csv
import io
import re
import uuid

from models import (
    ConsignorCreate,
    ConsignorImportFlagged,
    ConsignorImportResult,
    ConsignorImportRowIssue,
    ConsignorUpdate,
)
from auth import get_current_user
from id_gen import next_consignor_id

router = APIRouter(prefix="/api/consignors", tags=["consignors"])

PAYOUT_METHODS = {"Cash", "Check", "Zelle", "Venmo", "Store Credit"}
_HEADER_ALIASES = {
    "consignor_id": {
        "id",
        "consignor_id",
        "consignor",
        "ee_id",
        "boutique_id",
        "account_id",
    },
    "full_name": {"full_name", "fullname", "name", "consignor_name"},
    "phone": {
        "phone",
        "phone_number",
        "phonenumber",
        "mobile",
        "cell",
        "telephone",
    },
    "email": {"email", "e_mail", "email_address"},
    "address": {"address", "street_address", "mailing_address"},
    "expiry_action": {
        "expired_items",
        "expiry_action",
        "expire_action",
        "expired",
        "expiration",
        "donate_or_pickup",
        "donate_pickup",
    },
    "date_of_drop_off": {
        "date_of_drop_off",
        "drop_off_date",
        "date_of_dropoff",
        "dropoff_date",
        "date_in",
        "drop_off",
        "date",
    },
    "payout_method": {"payout_method", "payout", "method", "payment_method"},
    "payout_details": {"payout_details", "payout_detail", "payment_details"},
    "notes": {
        "notes",
        "note",
        "comments",
        "comment",
        "extra_notes",
        "extra_note",
    },
}
_TEMPLATE_CSV = (
    "id,name,email,phone_number,expired_items,date_of_drop_off,extra_notes\n"
    "2001,Jane Doe,jane@example.com,508-555-0100,donate,2026-03-15,Venmo @jane-doe\n"
    "2002,,,,pick-up,,\n"
    "2003,Sam Lee,,,1/4,,needs contact info\n"
)


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


def _norm_header(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (raw or "").strip().lower()).strip("_")


def _map_headers(fieldnames: list[str] | None) -> dict[str, str]:
    """Map canonical field → actual CSV column name."""
    mapping: dict[str, str] = {}
    if not fieldnames:
        return mapping
    for col in fieldnames:
        key = _norm_header(col)
        for canonical, aliases in _HEADER_ALIASES.items():
            if key in aliases and canonical not in mapping:
                mapping[canonical] = col
                break
    return mapping


def _norm_phone(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "")


def _cell(row: dict, mapping: dict[str, str], field: str) -> str:
    col = mapping.get(field)
    if not col:
        return ""
    return (row.get(col) or "").strip()


def _normalize_external_id(raw: str) -> str:
    """Keep boutique IDs as digit strings (e.g. 2001)."""
    s = (raw or "").strip()
    if not s:
        return ""
    digits = re.sub(r"\D+", "", s)
    if digits and (digits == s or re.fullmatch(r"\d+", s)):
        return digits
    # Allow already-formatted IDs like EE-001
    return s


def _parse_drop_off_date(raw: str) -> tuple[str, bool]:
    """Return (value, parsed_ok). Empty input → ('', True)."""
    s = (raw or "").strip()
    if not s:
        return "", True
    formats = (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%m-%d-%Y",
        "%m-%d-%y",
        "%d/%m/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%B %d %Y",
        "%b %d %Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date().isoformat(), True
        except ValueError:
            continue
    return s, False


def _infer_payout_from_notes(notes: str) -> tuple[str, str]:
    """Best-effort Venmo/Zelle detection from freeform notes."""
    text = notes or ""
    lower = text.lower()
    if "venmo" in lower or re.search(r"(?<!\w)@[A-Za-z0-9._-]+", text):
        m = re.search(r"@[A-Za-z0-9._-]+", text)
        detail = m.group(0) if m else text.strip()
        return "Venmo", detail
    if "zelle" in lower:
        return "Zelle", text.strip()
    return "Cash", ""


def _compute_import_flags(
    *,
    full_name: str,
    email: str,
    phone: str,
    date_of_drop_off: str,
    date_parsed_ok: bool,
) -> list[str]:
    flags: list[str] = []
    if len(full_name.strip()) < 2:
        flags.append("missing_name")
    if not email and not phone:
        flags.append("missing_contact")
    if not date_of_drop_off:
        flags.append("missing_drop_off_date")
    elif not date_parsed_ok:
        flags.append("unparsed_drop_off_date")
    return flags


async def _insert_consignor(db, body: ConsignorCreate) -> dict:
    cid = (body.consignor_id or "").strip() or await next_consignor_id(db)
    existing = await db.consignors.find_one({"consignor_id": cid}, {"_id": 1})
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Consignor ID {cid} already exists"
        )

    flags = list(body.import_flags or [])
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
        "expiry_action": body.expiry_action or "",
        "date_of_drop_off": body.date_of_drop_off or "",
        "import_flags": flags,
        "needs_review": bool(flags),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consignors.insert_one(doc)
    doc.pop("_id", None)
    doc["active_items"] = 0
    doc["total_owed"] = 0.0
    return doc


@router.get("")
async def list_consignors(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    consignors = await db.consignors.find({}, {"_id": 0}).to_list(5000)
    for c in consignors:
        c["active_items"] = await _active_count(db, c["consignor_id"])
        c["total_owed"] = await _balance_for(db, c["consignor_id"])
        c.setdefault("import_flags", [])
        c.setdefault("needs_review", bool(c.get("import_flags")))
        c.setdefault("expiry_action", "")
        c.setdefault("date_of_drop_off", "")
    return consignors


@router.post("")
async def create_consignor(
    body: ConsignorCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    return await _insert_consignor(db, body)


@router.get("/import/template")
async def import_template(_u: dict = Depends(get_current_user)):
    return Response(
        content=_TEMPLATE_CSV,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="consignors-import-template.csv"'
        },
    )


@router.post("/import", response_model=ConsignorImportResult)
async def import_consignors(
    request: Request,
    file: UploadFile = File(...),
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=400, detail="File must be UTF-8 CSV"
        ) from e

    reader = csv.DictReader(io.StringIO(text))
    mapping = _map_headers(reader.fieldnames)
    if "consignor_id" not in mapping and "full_name" not in mapping:
        raise HTTPException(
            status_code=400,
            detail="CSV must include an id and/or name column",
        )

    existing = await db.consignors.find(
        {},
        {
            "_id": 0,
            "consignor_id": 1,
            "full_name": 1,
            "email": 1,
            "phone": 1,
        },
    ).to_list(10000)

    id_index: dict[str, str] = {}
    email_index: dict[str, str] = {}
    name_phone_index: dict[tuple[str, str], str] = {}
    for c in existing:
        id_index[c["consignor_id"]] = c["consignor_id"]
        email = (c.get("email") or "").strip().lower()
        if email:
            email_index[email] = c["consignor_id"]
        name = (c.get("full_name") or "").strip().lower()
        phone = _norm_phone(c.get("phone") or "")
        if name and phone:
            name_phone_index[(name, phone)] = c["consignor_id"]

    created_ids: list[str] = []
    skipped_rows: list[ConsignorImportRowIssue] = []
    errors: list[ConsignorImportRowIssue] = []
    flagged_rows: list[ConsignorImportFlagged] = []

    for i, row in enumerate(reader, start=2):  # row 1 = header
        if not any((v or "").strip() for v in row.values()):
            continue

        raw_id = _cell(row, mapping, "consignor_id")
        cid = _normalize_external_id(raw_id)
        full_name = _cell(row, mapping, "full_name")
        phone = _cell(row, mapping, "phone")
        email = _cell(row, mapping, "email").lower()
        expiry_action = _cell(row, mapping, "expiry_action")
        drop_raw = _cell(row, mapping, "date_of_drop_off")
        notes = _cell(row, mapping, "notes")
        address = _cell(row, mapping, "address")

        if not cid and len(full_name) < 2:
            errors.append(
                ConsignorImportRowIssue(
                    row=i, reason="missing id and name"
                )
            )
            continue

        date_of_drop_off, date_ok = _parse_drop_off_date(drop_raw)

        payout_method = _cell(row, mapping, "payout_method")
        payout_details = _cell(row, mapping, "payout_details")
        if not payout_method:
            inferred_method, inferred_details = _infer_payout_from_notes(notes)
            payout_method = inferred_method
            if not payout_details:
                payout_details = inferred_details
        else:
            payout_lookup = {m.lower(): m for m in PAYOUT_METHODS}
            if payout_method.lower() in payout_lookup:
                payout_method = payout_lookup[payout_method.lower()]
            if payout_method not in PAYOUT_METHODS:
                errors.append(
                    ConsignorImportRowIssue(
                        row=i,
                        reason=f"invalid payout_method '{payout_method}'",
                    )
                )
                continue

        if cid and cid in id_index:
            skipped_rows.append(
                ConsignorImportRowIssue(
                    row=i,
                    reason="duplicate id",
                    matched_id=id_index[cid],
                )
            )
            continue

        if email and email in email_index:
            skipped_rows.append(
                ConsignorImportRowIssue(
                    row=i,
                    reason="duplicate email",
                    matched_id=email_index[email],
                )
            )
            continue

        display_name = full_name if len(full_name) >= 2 else f"(Name needed · {cid or 'new'})"
        np_key = (display_name.strip().lower(), _norm_phone(phone))
        # Only dedupe name+phone when a real name was provided
        if len(full_name) >= 2 and np_key[1] and np_key in name_phone_index:
            skipped_rows.append(
                ConsignorImportRowIssue(
                    row=i,
                    reason="duplicate name + phone",
                    matched_id=name_phone_index[np_key],
                )
            )
            continue

        flags = _compute_import_flags(
            full_name=full_name,
            email=email,
            phone=phone,
            date_of_drop_off=drop_raw,
            date_parsed_ok=date_ok,
        )

        body = ConsignorCreate(
            consignor_id=cid or None,
            full_name=display_name,
            phone=phone,
            email=email,
            address=address,
            payout_method=payout_method,  # type: ignore[arg-type]
            payout_details=payout_details,
            notes=notes,
            expiry_action=expiry_action,
            date_of_drop_off=date_of_drop_off,
            import_flags=flags,
        )
        try:
            doc = await _insert_consignor(db, body)
        except HTTPException as e:
            errors.append(
                ConsignorImportRowIssue(row=i, reason=str(e.detail))
            )
            continue

        new_id = doc["consignor_id"]
        created_ids.append(new_id)
        id_index[new_id] = new_id
        if email:
            email_index[email] = new_id
        if len(full_name) >= 2 and np_key[1]:
            name_phone_index[np_key] = new_id
        if flags:
            flagged_rows.append(
                ConsignorImportFlagged(
                    row=i, consignor_id=new_id, flags=flags
                )
            )

    return ConsignorImportResult(
        created=len(created_ids),
        skipped=len(skipped_rows),
        flagged=len(flagged_rows),
        errors=errors,
        created_ids=created_ids,
        skipped_rows=skipped_rows,
        flagged_rows=flagged_rows,
    )


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
    c.setdefault("import_flags", [])
    c.setdefault("needs_review", bool(c.get("import_flags")))
    c.setdefault("expiry_action", "")
    c.setdefault("date_of_drop_off", "")
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
    if "import_flags" in updates:
        updates["needs_review"] = bool(updates["import_flags"])
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
