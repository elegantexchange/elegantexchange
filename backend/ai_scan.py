"""OpenAI Vision helper for two-shot item + tag scan assist."""
from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

from openai import AsyncOpenAI

from csv_import_utils import normalize_external_id, parse_flexible_date, parse_money

CATEGORIES = [
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
]
CONDITIONS = ["Excellent", "Like New", "Very Good", "Good", "Fair"]
CONFIDENCE = {"high", "medium", "low"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}

_SYSTEM_PROMPT = """You help boutique consignment staff digitize inventory from two photos:
1) ITEM photo — the garment/accessory itself
2) TAG photo — the paper/plastic tag on the item

Extract structured JSON only. No markdown.

From the TAG (prefer printed/handwritten tag text):
- consignor_id: boutique account ID, often 4 digits like 2001 (not the EE-#### item SKU unless that is all you see)
- date_in: intake/date-in if present (any common date format)
- asking_price: price if printed on tag
- text_id: any secondary code/SKU on the tag
- tag_description: short text printed on the tag if any

From the ITEM photo (and tag when helpful):
- description: clear boutique-style description (e.g. "Cream textured crossbody bag")
- color: primary color
- category: MUST be one of: Dresses, Tops, Bottoms, Denim, Outerwear, Handbags, Shoes, Accessories, Jewelry, Other
- size: if visible on tag or garment
- condition: one of Excellent, Like New, Very Good, Good, Fair if you can judge; else empty
- rack: only if clearly written on tag

For each field you populate, set confidence high|medium|low.
Add brief notes if anything is unclear or conflicting.

Return JSON with keys:
consignor_id, text_id, description, category, size, condition, color, rack,
asking_price, date_in, confidence (object of field->level), notes
Use empty string or null for unknown fields. asking_price may be a number or string.
"""


class ScanAssistError(Exception):
    """Raised for user-facing scan failures."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def require_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise ScanAssistError(
            "AI scan is not configured. Set OPENAI_API_KEY on the server.",
            status_code=503,
        )
    return key


def validate_image(data: bytes, content_type: str | None, label: str) -> str:
    if not data:
        raise ScanAssistError(f"Missing {label}")
    if len(data) > MAX_IMAGE_BYTES:
        raise ScanAssistError(f"{label} is too large (max 8MB)")
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME:
        # sniff common formats
        if data[:3] == b"\xff\xd8\xff":
            mime = "image/jpeg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n":
            mime = "image/png"
        elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            mime = "image/webp"
        else:
            raise ScanAssistError(f"{label} must be JPEG, PNG, or WebP")
    return mime


def _data_url(mime: str, data: bytes) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _extract_json(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        raise ScanAssistError("AI returned an empty response", status_code=502)
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise ScanAssistError("AI returned invalid JSON", status_code=502) from None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError as e:
            raise ScanAssistError("AI returned invalid JSON", status_code=502) from e
    if not isinstance(data, dict):
        raise ScanAssistError("AI returned unexpected JSON shape", status_code=502)
    return data


def _norm_confidence(raw: Any) -> dict[str, str]:
    out: dict[str, str] = {}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        level = str(v or "").strip().lower()
        if level in CONFIDENCE:
            out[str(k)] = level
    return out


def _norm_category(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return "Other"
    lookup = {c.lower(): c for c in CATEGORIES}
    return lookup.get(s.lower(), "Other")


def _norm_condition(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    lookup = {c.lower(): c for c in CONDITIONS}
    return lookup.get(s.lower(), "")


def normalize_scan_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Validate/normalize model JSON into ScanAssistResult-ready dict."""
    cid = normalize_external_id(str(data.get("consignor_id") or ""))
    # Prefer boutique digit IDs; keep EE- style if that is what was on the tag
    description = (
        str(data.get("description") or data.get("tag_description") or "")
    ).strip()
    price_raw = data.get("asking_price")
    if price_raw is None or price_raw == "":
        asking_price = None
        price_ok = True
    else:
        asking_price, price_ok = parse_money(str(price_raw))
        if not price_ok:
            asking_price = None

    date_raw = str(data.get("date_in") or "").strip()
    date_in, date_ok = parse_flexible_date(date_raw)
    if date_raw and not date_ok:
        date_in = ""

    category = _norm_category(str(data.get("category") or ""))

    confidence = _norm_confidence(data.get("confidence"))
    if description and "description" not in confidence:
        confidence["description"] = "medium"
    if cid and "consignor_id" not in confidence:
        confidence["consignor_id"] = "medium"

    notes = str(data.get("notes") or "").strip()
    if date_raw and not date_ok:
        notes = (notes + " Unparsed date on tag.").strip()
    if price_raw not in (None, "") and not price_ok:
        notes = (notes + " Unparsed price on tag.").strip()

    return {
        "consignor_id": cid,
        "text_id": str(data.get("text_id") or "").strip(),
        "description": description,
        "category": category,
        "size": str(data.get("size") or "").strip(),
        "condition": _norm_condition(str(data.get("condition") or "")),
        "color": str(data.get("color") or "").strip(),
        "rack": str(data.get("rack") or "").strip(),
        "asking_price": asking_price,
        "date_in": date_in,
        "confidence": confidence,
        "notes": notes,
    }


async def analyze_item_and_tag(
    *,
    item_bytes: bytes,
    item_mime: str,
    tag_bytes: bytes,
    tag_mime: str,
) -> dict[str, Any]:
    api_key = require_api_key()
    client = AsyncOpenAI(api_key=api_key)
    model = (os.environ.get("OPENAI_SCAN_MODEL") or "gpt-4o-mini").strip()

    try:
        response = await client.chat.completions.create(
            model=model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Image 1 is the ITEM. Image 2 is the TAG. Return JSON only.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": _data_url(item_mime, item_bytes),
                                "detail": "high",
                            },
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": _data_url(tag_mime, tag_bytes),
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
        )
    except Exception as e:
        raise ScanAssistError(f"AI scan failed: {e}", status_code=502) from e

    try:
        content = response.choices[0].message.content or ""
    except (IndexError, AttributeError) as e:
        raise ScanAssistError("AI scan failed: empty model response", status_code=502) from e

    raw = _extract_json(content)
    return normalize_scan_payload(raw)
