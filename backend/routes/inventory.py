"""Inventory routes."""
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta, date
import csv
import io
import re
import uuid

from models import (
    BulkAction,
    InventoryImportFlagged,
    InventoryImportResult,
    InventoryImportRowIssue,
    InventoryItemCreate,
    InventoryItemUpdate,
    ScanAssistResult,
)
from auth import get_current_user, normalize_role, require_roles
from id_gen import next_item_id
from boutique_settings import current_consignor_split_pct
from categorize import capitalize_description, infer_category
from floor_operator import operator_from_request
from house_stock import (
    HOUSE_CONSIGNOR_ID,
    HOUSE_DISPLAY_NAME,
    ensure_house_consignor,
    is_house_consignor,
)
from csv_import_utils import (
    cell,
    map_headers,
    normalize_external_id,
    parse_flexible_date,
    parse_money,
)
from sale_ops import (
    insert_sale,
    insert_pending_sale,
    cancel_pending_sales_for_items,
)
from ai_scan import ScanAssistError, analyze_item_and_tag, validate_image

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

CATEGORIES = {
    "Dresses",
    "Tops",
    "Bottoms",
    "Denim",
    "Outerwear",
    "Handbags",
    "Shoes",
    "Accessories",
    "Jewelry",
    "Other",
}
CONDITIONS = {"Excellent", "Like New", "Very Good", "Good", "Fair"}
MAX_MEDIA = 10
MAX_DATA_URL_CHARS = 6_000_000  # ~4.5MB binary after base64
# Matches Notion inventory export: style/description, rack, date, color, size, price, ID, text ID, files and media
_HEADER_ALIASES = {
    "consignor_id": {
        "consignor_id",
        "id",
        "consignor",
        "ee_id",
        "boutique_id",
        "account_id",
        "seller_id",
    },
    "consignor_name": {
        "consignor_name",
        "full_name",
        "seller",
        "seller_name",
    },
    "description": {
        "description",
        "style_description",
        "style",
        "item",
        "item_description",
        "desc",
        "title",
        "product",
        "name",
    },
    "text_id": {
        "text_id",
        "textid",
        "sku",
        "item_text_id",
        "item_code",
    },
    "rack": {
        "rack",
        "location",
        "shelf",
        "display",
        "rack_location",
    },
    "color": {"color", "colour"},
    "category": {"category", "cat", "type", "department"},
    "size": {"size", "sz"},
    "condition": {"condition", "cond", "item_condition"},
    "asking_price": {
        "asking_price",
        "price",
        "list_price",
        "retail",
        "amount",
        "cost",
    },
    "date_in": {
        "date_in",
        "date_of_drop_off",
        "drop_off_date",
        "date",
        "received",
        "intake_date",
    },
    "media": {
        "media",
        "files_and_media",
        "files",
        "photos",
        "images",
        "photo",
        "image",
    },
    "status": {"status", "item_status"},
    "sale_price": {
        "sale_price",
        "sold_price",
        "sold_for",
        "price_sold",
    },
    "notes": {"notes", "note", "comments", "extra_notes"},
}
_TEMPLATE_CSV = (
    "ID,text ID,style/description,rack,date,color,size,price,status,sale_price,files and media\n"
    "2001,BAG-01,Cream textured bag,gold rack (1),2026-06-01,cream,,14.95,Active,,\n"
    "2007,,Pink bag with gold chain,gold rack (1),2026-06-01,pink,,14.95,Sold,12.00,\n"
    "2016,,,,gold rack (1),,,,,,\n"
)


def _normalize_media(raw) -> list[str]:
    """Validate and cap inventory media (https URLs or data:image URLs)."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="media must be a list")
    out: list[str] = []
    for entry in raw:
        if not isinstance(entry, str):
            raise HTTPException(status_code=400, detail="Each media entry must be a string")
        url = entry.strip()
        if not url:
            continue
        if url.startswith("data:image/"):
            if len(url) > MAX_DATA_URL_CHARS:
                raise HTTPException(status_code=400, detail="Image is too large")
        elif not (url.startswith("https://") or url.startswith("http://")):
            raise HTTPException(
                status_code=400,
                detail="Media must be an image URL or uploaded image",
            )
        out.append(url)
        if len(out) >= MAX_MEDIA:
            break
    return out


def _parse_media(raw: str) -> list[str]:
    """Split Notion/CSV media cells into URL or filename strings."""
    s = (raw or "").strip()
    if not s:
        return []
    parts = re.split(r"[\n;|]+", s) if "\n" in s or ";" in s or "|" in s else [s]
    if len(parts) == 1 and "," in s and ("http" in s.lower() or "/" in s):
        parts = [p.strip() for p in s.split(",") if p.strip()]
        return parts
    return [p.strip() for p in parts if p.strip()]


def _infer_category_from_rack(rack: str) -> str | None:
    r = (rack or "").strip().lower()
    if not r:
        return None
    if "shoe" in r:
        return "Shoes"
    if "jean" in r or "denim" in r:
        return "Denim"
    if "accessor" in r or "jewel" in r:
        return "Accessories"
    if "handbag" in r or ("bag" in r and "rack" not in r):
        return "Handbags"
    return None


def _today_iso() -> str:
    return date.today().isoformat()


def _period_end(date_in_iso: str) -> str:
    d = date.fromisoformat(date_in_iso[:10])
    return (d + timedelta(days=60)).isoformat()


def _norm_category(raw: str) -> tuple[str, bool]:
    """Return (category, known). Empty → ('Other', False)."""
    s = (raw or "").strip()
    if not s:
        return "Other", False
    lookup = {c.lower(): c for c in CATEGORIES}
    if s.lower() in lookup:
        return lookup[s.lower()], True
    return s, False


def _norm_condition(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    lookup = {c.lower(): c for c in CONDITIONS}
    return lookup.get(s.lower(), s)


def _compute_item_flags(
    *,
    description: str,
    category_raw: str,
    category_known: bool,
    category_inferred: bool,
    rack: str,
    asking_price: float | None,
    price_ok: bool,
    date_in_raw: str,
    date_ok: bool,
    consignor_created: bool,
) -> list[str]:
    flags: list[str] = []
    if len(description.strip()) < 2:
        flags.append("missing_description")
    # Racks are no longer a review requirement
    if category_raw.strip() and not category_known and not category_inferred:
        flags.append("unknown_category")
    elif not category_raw.strip() and not category_inferred:
        flags.append("missing_category")
    if not price_ok:
        flags.append("unparsed_price")
    elif asking_price is None:
        flags.append("missing_price")
    if not date_in_raw.strip():
        flags.append("missing_date_in")
    elif not date_ok:
        flags.append("unparsed_date_in")
    if consignor_created:
        flags.append("consignor_created")
    return flags


async def _ensure_consignor(
    db,
    *,
    cid: str,
    name: str,
    id_index: dict[str, str],
    name_index: dict[str, list[str]],
) -> tuple[str, bool]:
    """Resolve or create a consignor. Returns (consignor_id, created).

    Raises ValueError for unrecoverable row-level problems.
    """
    if cid and cid in id_index:
        return cid, False

    if not cid and name:
        matches = name_index.get(name.strip().lower(), [])
        if len(matches) == 1:
            return matches[0], False
        if len(matches) > 1:
            raise ValueError(f"ambiguous consignor name '{name}'")
        raise ValueError(
            f"unknown consignor '{name}' — include consignor_id to auto-create"
        )

    if not cid:
        raise ValueError("missing consignor id")

    display = name.strip() if len(name.strip()) >= 2 else f"(Name needed · {cid})"
    flags = ["missing_name"] if len(name.strip()) < 2 else []
    flags.append("missing_contact")
    split_pct = await current_consignor_split_pct(db)
    doc = {
        "id": str(uuid.uuid4()),
        "consignor_id": cid,
        "full_name": display,
        "phone": "",
        "email": "",
        "address": "",
        "payout_method": "Cash",
        "payout_details": "",
        "notes": "Auto-created from inventory import",
        "expiry_action": "",
        "date_of_drop_off": "",
        "import_flags": flags,
        "needs_review": True,
        "consignor_split_pct": split_pct,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consignors.insert_one(doc)
    id_index[cid] = cid
    key = display.strip().lower()
    name_index.setdefault(key, []).append(cid)
    return cid, True


async def _refresh_expired(db):
    today = _today_iso()
    await db.inventory.update_many(
        {"status": "Active", "period_end": {"$lte": today}},
        {"$set": {"status": "Expired"}},
    )


@router.get("")
async def list_inventory(request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    await _refresh_expired(db)
    items = await db.inventory.find({}, {"_id": 0}).sort("date_in", -1).to_list(10000)
    # Attach consignor name (house stock always shows as "In House")
    from house_stock import HOUSE_DISPLAY_NAME, is_house_item

    cids = list({i["consignor_id"] for i in items})
    cmap = {}
    async for c in db.consignors.find({"consignor_id": {"$in": cids}}, {"_id": 0}):
        cmap[c["consignor_id"]] = c
    for i in items:
        c = cmap.get(i["consignor_id"])
        if is_house_item(i, c):
            i["consignor_name"] = HOUSE_DISPLAY_NAME
            i["is_house"] = True
        else:
            i["consignor_name"] = (c or {}).get("full_name", "") or ""
            i.setdefault("is_house", False)
        i.setdefault("import_flags", [])
        i.setdefault("needs_review", bool(i.get("import_flags")))
        i.setdefault("rack", "")
        i.setdefault("color", "")
        i.setdefault("text_id", "")
        i.setdefault("media", [])
    return items


@router.post("")
async def create_item(
    body: InventoryItemCreate, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    cid = (body.consignor_id or "").strip()
    if cid.upper() == HOUSE_CONSIGNOR_ID or cid == "2999":
        await ensure_house_consignor(db)
        cid = HOUSE_CONSIGNOR_ID if cid.upper() == HOUSE_CONSIGNOR_ID else cid
    consignor = await db.consignors.find_one({"consignor_id": cid})
    if not consignor:
        raise HTTPException(status_code=400, detail="Unknown consignor")
    house = is_house_consignor(consignor)
    date_in = body.date_in or _today_iso()
    item_id = await next_item_id(db, cid)
    split_pct = 0.0 if house else await current_consignor_split_pct(db)
    description = capitalize_description(body.description)
    category = body.category or infer_category(description, body.rack or "")
    if category not in CATEGORIES:
        category = infer_category(description, body.rack or "", category)
    doc = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "consignor_id": cid,
        "description": description,
        "category": category if category in CATEGORIES else "Other",
        "size": body.size or "",
        "condition": body.condition or "",
        "asking_price": float(body.asking_price),
        "date_in": date_in,
        "period_end": _period_end(date_in),
        "status": "Active",
        "date_sold": None,
        "sale_price": None,
        "rack": body.rack or "",
        "color": body.color or "",
        "text_id": body.text_id or "",
        "media": _normalize_media(body.media or []),
        "consignor_split_pct": split_pct,
        "is_house": house,
        "ownership": "house" if house else "consignor",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "operator_name": operator_from_request(request),
        "created_by": _u.get("email") or "",
    }
    await db.inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/batch")
async def create_items_batch(
    payload: dict, request: Request, _u: dict = Depends(get_current_user)
):
    """Batch intake: { consignor_id, items: [...] }"""
    db = request.app.state.db
    consignor_id = (payload.get("consignor_id") or "").strip()
    items_in = payload.get("items", [])
    if consignor_id.upper() == HOUSE_CONSIGNOR_ID or consignor_id == "2999":
        await ensure_house_consignor(db)
        if consignor_id.upper() == HOUSE_CONSIGNOR_ID:
            consignor_id = HOUSE_CONSIGNOR_ID
    consignor = await db.consignors.find_one({"consignor_id": consignor_id})
    if not consignor:
        raise HTTPException(status_code=400, detail="Unknown consignor")
    house = is_house_consignor(consignor)
    created = []
    split_pct = 0.0 if house else await current_consignor_split_pct(db)
    for raw in items_in:
        date_in = raw.get("date_in") or _today_iso()
        item_id = await next_item_id(db, consignor_id)
        description = capitalize_description(raw.get("description", "") or "")
        category = raw.get("category", "") or infer_category(
            description, raw.get("rack", "") or ""
        )
        if category not in CATEGORIES:
            category = "Other"
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor_id,
            "description": description,
            "category": category,
            "size": raw.get("size", ""),
            "condition": raw.get("condition", ""),
            "asking_price": float(raw.get("asking_price", 0)),
            "date_in": date_in,
            "period_end": _period_end(date_in),
            "status": "Active",
            "date_sold": None,
            "sale_price": None,
            "rack": raw.get("rack", "") or "",
            "color": raw.get("color", "") or "",
            "text_id": raw.get("text_id", "") or "",
            "media": list(raw.get("media") or []),
            "consignor_split_pct": split_pct,
            "is_house": house,
            "ownership": "house" if house else "consignor",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "operator_name": operator_from_request(request),
            "created_by": _u.get("email") or "",
        }
        await db.inventory.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    return {
        "items": created,
        "consignor": {
            "consignor_id": consignor_id,
            "full_name": HOUSE_DISPLAY_NAME if house else consignor["full_name"],
            "is_house": house,
        },
    }


@router.get("/import/template")
async def import_template(_u: dict = Depends(get_current_user)):
    return Response(
        content=_TEMPLATE_CSV,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="inventory-import-template.csv"'
        },
    )


@router.post("/scan-assist", response_model=ScanAssistResult)
async def scan_assist(
    item_image: UploadFile = File(...),
    tag_image: UploadFile = File(...),
    _u: dict = Depends(get_current_user),
):
    """Two-shot AI assist: item photo + tag photo → suggested inventory fields."""
    item_bytes = await item_image.read()
    tag_bytes = await tag_image.read()
    try:
        item_mime = validate_image(item_bytes, item_image.content_type, "item image")
        tag_mime = validate_image(tag_bytes, tag_image.content_type, "tag image")
        result = await analyze_item_and_tag(
            item_bytes=item_bytes,
            item_mime=item_mime,
            tag_bytes=tag_bytes,
            tag_mime=tag_mime,
        )
    except ScanAssistError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
    return ScanAssistResult(**result)


@router.post("/import", response_model=InventoryImportResult)
async def import_inventory(
    request: Request,
    file: UploadFile = File(...),
    _u: dict = Depends(get_current_user),
):
    """Smart CSV import: incomplete rows still create items; consignors sync by ID/name."""
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
    mapping = map_headers(reader.fieldnames, _HEADER_ALIASES)
    if "consignor_id" not in mapping and "consignor_name" not in mapping:
        raise HTTPException(
            status_code=400,
            detail="CSV must include an ID (consignor) column",
        )
    if (
        "description" not in mapping
        and "asking_price" not in mapping
        and "rack" not in mapping
    ):
        raise HTTPException(
            status_code=400,
            detail="CSV must include style/description, price, and/or rack columns",
        )

    existing = await db.consignors.find(
        {}, {"_id": 0, "consignor_id": 1, "full_name": 1}
    ).to_list(10000)
    id_index: dict[str, str] = {}
    name_index: dict[str, list[str]] = {}
    for c in existing:
        cid = c["consignor_id"]
        id_index[cid] = cid
        key = (c.get("full_name") or "").strip().lower()
        if key:
            name_index.setdefault(key, []).append(cid)

    created_ids: list[str] = []
    created_consignor_ids: list[str] = []
    skipped_rows: list[InventoryImportRowIssue] = []
    errors: list[InventoryImportRowIssue] = []
    flagged_rows: list[InventoryImportFlagged] = []

    for i, row in enumerate(reader, start=2):
        if not any((v or "").strip() for v in row.values()):
            continue

        raw_cid = cell(row, mapping, "consignor_id")
        cid = normalize_external_id(raw_cid)
        cname = cell(row, mapping, "consignor_name")
        description = cell(row, mapping, "description")
        text_id = cell(row, mapping, "text_id")
        rack = cell(row, mapping, "rack")
        color = cell(row, mapping, "color")
        category_raw = cell(row, mapping, "category")
        size = cell(row, mapping, "size")
        condition = _norm_condition(cell(row, mapping, "condition"))
        price_raw = cell(row, mapping, "asking_price")
        date_raw = cell(row, mapping, "date_in")
        media = _parse_media(cell(row, mapping, "media"))
        status_raw = cell(row, mapping, "status")
        sale_price_raw = cell(row, mapping, "sale_price")
        notes = cell(row, mapping, "notes")

        # Completely empty of useful item data
        if (
            not cid
            and not cname
            and len(description) < 2
            and not price_raw
            and not rack
        ):
            errors.append(
                InventoryImportRowIssue(row=i, reason="missing consignor and item data")
            )
            continue

        try:
            consignor_id, consignor_created = await _ensure_consignor(
                db,
                cid=cid,
                name=cname,
                id_index=id_index,
                name_index=name_index,
            )
        except ValueError as e:
            errors.append(InventoryImportRowIssue(row=i, reason=str(e)))
            continue

        if consignor_created and consignor_id not in created_consignor_ids:
            created_consignor_ids.append(consignor_id)

        category_inferred = False
        if category_raw.strip():
            category, category_known = _norm_category(category_raw)
            if category == "Other" or not category_known:
                smart = infer_category(description, rack, category)
                if smart != "Other":
                    category, category_known = smart, True
                    category_inferred = True
        else:
            inferred = _infer_category_from_rack(rack) or infer_category(
                description, rack
            )
            if inferred and inferred != "Other":
                category, category_known = inferred, True
                category_inferred = True
            else:
                category, category_known = "Other", False
        price, price_ok = parse_money(price_raw)
        date_in, date_ok = parse_flexible_date(date_raw)

        # Still import incomplete rows with defaults
        display_desc = capitalize_description(
            description if len(description) >= 2 else "(Description needed)"
        )
        if price is None or not price_ok:
            asking_price = 0.0
        else:
            asking_price = float(price)
        if not date_in or not date_ok:
            date_in = _today_iso()

        status = "Active"
        if status_raw:
            status_lookup = {
                "active": "Active",
                "expired": "Expired",
                "sold": "Sold",
                "donated": "Donated",
                "returned": "Returned",
            }
            status = status_lookup.get(status_raw.strip().lower(), "Active")
            if status_raw.strip().lower() not in status_lookup:
                # keep freeform only if it matches canonical casing already
                if status_raw.strip() in {
                    "Active",
                    "Expired",
                    "Sold",
                    "Donated",
                    "Returned",
                }:
                    status = status_raw.strip()

        flags = _compute_item_flags(
            description=description,
            category_raw=category_raw,
            category_known=category_known,
            category_inferred=category_inferred,
            rack=rack,
            asking_price=price,
            price_ok=price_ok,
            date_in_raw=date_raw,
            date_ok=date_ok,
            consignor_created=consignor_created,
        )
        # Boutique Notion sheets omit category by design when rack is set
        if rack and "missing_category" in flags:
            flags = [f for f in flags if f != "missing_category"]

        item_id = await next_item_id(db, consignor_id)
        split_pct = await current_consignor_split_pct(db)
        doc = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "consignor_id": consignor_id,
            "description": display_desc,
            "category": category,
            "size": size,
            "condition": condition,
            "asking_price": asking_price,
            "date_in": date_in,
            "period_end": _period_end(date_in),
            "status": status,
            "date_sold": None,
            "sale_price": None,
            "rack": rack,
            "color": color,
            "text_id": text_id,
            "media": media,
            "notes": notes,
            "import_flags": flags,
            "needs_review": bool(flags),
            "consignor_split_pct": split_pct,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory.insert_one(doc)
        if status == "Sold":
            sold_amt, sold_ok = parse_money(sale_price_raw)
            if sold_amt is None or not sold_ok or sold_amt <= 0:
                sold_amt = asking_price
            if sold_amt and sold_amt > 0:
                await insert_sale(
                    db,
                    item=doc,
                    sale_price=float(sold_amt),
                    notes="Imported sold item",
                    sale_date=date_in,
                    created_by="import",
                )
            else:
                flags = list(flags) + (
                    ["missing_sale_price"] if "missing_sale_price" not in flags else []
                )
                doc["import_flags"] = flags
                doc["needs_review"] = True
                await db.inventory.update_one(
                    {"item_id": item_id},
                    {"$set": {"import_flags": flags, "needs_review": True}},
                )
        elif status == "Expired" and asking_price > 0:
            await insert_pending_sale(
                db,
                item=doc,
                sale_price=float(asking_price),
                notes="Expired floor — consignor cut on asking price",
                source="expired_floor",
                sale_date=doc.get("period_end") or date_in,
                created_by="import",
                mark_sold=False,
            )
        created_ids.append(item_id)
        if flags:
            flagged_rows.append(
                InventoryImportFlagged(
                    row=i,
                    item_id=item_id,
                    consignor_id=consignor_id,
                    flags=flags,
                )
            )

    return InventoryImportResult(
        created=len(created_ids),
        skipped=len(skipped_rows),
        flagged=len(flagged_rows),
        consignors_created=len(created_consignor_ids),
        errors=errors,
        created_ids=created_ids,
        skipped_rows=skipped_rows,
        flagged_rows=flagged_rows,
        created_consignor_ids=created_consignor_ids,
    )


@router.get("/{item_id}")
async def get_item(item_id: str, request: Request, _u: dict = Depends(get_current_user)):
    db = request.app.state.db
    item = await db.inventory.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.setdefault("import_flags", [])
    item.setdefault("needs_review", bool(item.get("import_flags")))
    return item


@router.patch("/{item_id}")
async def update_item(
    item_id: str,
    body: InventoryItemUpdate,
    request: Request,
    _u: dict = Depends(get_current_user),
):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True}
    if normalize_role(_u.get("role")) == "retail" and "asking_price" in updates:
        raise HTTPException(
            status_code=403, detail="Retail cannot change listing price"
        )
    if "media" in updates:
        updates["media"] = _normalize_media(updates["media"])
    if "import_flags" in updates:
        updates["needs_review"] = bool(updates["import_flags"])
    existing = await db.inventory.find_one({"item_id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    await db.inventory.update_one({"item_id": item_id}, {"$set": updates})
    existing.update(updates)
    existing.setdefault("import_flags", [])
    existing.setdefault("needs_review", bool(existing.get("import_flags")))
    existing.setdefault("media", [])
    return existing


@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    request: Request,
    _u: dict = Depends(require_roles("admin", "manager")),
):
    db = request.app.state.db
    sale = await db.sales.find_one({"item_id": item_id})
    if sale:
        raise HTTPException(status_code=400, detail="Cannot delete item with sales")
    await db.inventory.delete_one({"item_id": item_id})
    return {"ok": True}


@router.post("/bulk")
async def bulk_action(
    body: BulkAction, request: Request, _u: dict = Depends(get_current_user)
):
    db = request.app.state.db
    status_map = {
        "sold": "Sold",
        "donated": "Donated",
        "returned": "Returned",
        "active": "Active",
    }
    new_status = status_map.get(body.action)
    update = {"status": new_status}
    if body.action == "sold":
        update["date_sold"] = _today_iso()
    await db.inventory.update_many(
        {"item_id": {"$in": body.item_ids}}, {"$set": update}
    )
    cancelled = 0
    if body.action in ("donated", "returned"):
        cancelled = await cancel_pending_sales_for_items(db, body.item_ids)
    return {"ok": True, "updated": len(body.item_ids), "cancelled_pendings": cancelled}
