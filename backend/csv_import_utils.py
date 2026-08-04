"""Shared helpers for smart CSV imports."""
from datetime import datetime
import re


def norm_header(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (raw or "").strip().lower()).strip("_")


def map_headers(fieldnames: list[str] | None, aliases: dict[str, set[str]]) -> dict[str, str]:
    """Map canonical field → actual CSV column name."""
    mapping: dict[str, str] = {}
    if not fieldnames:
        return mapping
    for col in fieldnames:
        key = norm_header(col)
        for canonical, names in aliases.items():
            if key in names and canonical not in mapping:
                mapping[canonical] = col
                break
    return mapping


def cell(row: dict, mapping: dict[str, str], field: str) -> str:
    col = mapping.get(field)
    if not col:
        return ""
    return (row.get(col) or "").strip()


def norm_phone(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "")


def normalize_external_id(raw: str) -> str:
    """Keep boutique IDs as digit strings (e.g. 2001)."""
    s = (raw or "").strip()
    if not s:
        return ""
    digits = re.sub(r"\D+", "", s)
    if digits and (digits == s or re.fullmatch(r"\d+", s)):
        return digits
    return s


def parse_flexible_date(raw: str) -> tuple[str, bool]:
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


def parse_money(raw: str) -> tuple[float | None, bool]:
    """Return (amount, ok). Empty → (None, True)."""
    s = (raw or "").strip()
    if not s:
        return None, True
    cleaned = re.sub(r"[^0-9.\-]", "", s.replace(",", ""))
    if not cleaned or cleaned in {".", "-", "-."}:
        return None, False
    try:
        return float(cleaned), True
    except ValueError:
        return None, False
