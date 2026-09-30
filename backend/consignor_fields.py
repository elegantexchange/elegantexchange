"""Phone, expiry, and address helpers for consignor profiles."""
import re

PHONE_TYPES = ("mobile", "home", "work")

_EXPIRY_ALIASES = {
    "donate": "donate",
    "donation": "donate",
    "donated": "donate",
    "pickup": "pick-up",
    "pick-up": "pick-up",
    "return": "return",
    "returned": "return",
}


def phone_digits(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits


def format_phone(raw: str) -> str:
    """US display (000) 000-0000 when the value has 10 digits. Otherwise keep it."""
    digits = phone_digits(raw)
    text = (raw or "").strip()
    if len(digits) != 10:
        return text
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def normalize_phones(phones, fallback: str = "") -> tuple[list[dict], str]:
    """Return (entries, primary). Ten-digit numbers are formatted; other text is kept."""
    source = list(phones or [])
    if not source and (fallback or "").strip():
        source = [{"type": "mobile", "number": fallback}]

    entries: list[dict] = []
    for row in source:
        if not isinstance(row, dict):
            continue
        kind = (row.get("type") or "mobile").strip().lower().replace(" ", "")
        if kind in ("cell", "mobile", "cell/mobile", "cellphone"):
            kind = "mobile"
        elif kind in ("home", "house", "landline"):
            kind = "home"
        elif kind in ("work", "office", "business"):
            kind = "work"
        else:
            kind = "mobile"
        raw = (row.get("number") or "").strip()
        if not raw:
            continue
        entries.append({"type": kind, "number": format_phone(raw)})

    primary = entries[0]["number"] if entries else ""
    return entries, primary


def present_phones(consignor: dict) -> None:
    """Ensure API responses always include a phones list alongside phone."""
    phones, primary = normalize_phones(consignor.get("phones"), consignor.get("phone") or "")
    consignor["phones"] = phones
    if primary:
        consignor["phone"] = primary
    elif not (consignor.get("phone") or "").strip():
        consignor["phone"] = ""


def has_phone(doc: dict) -> bool:
    if (doc.get("phone") or "").strip():
        return True
    for entry in doc.get("phones") or []:
        if isinstance(entry, dict) and (entry.get("number") or "").strip():
            return True
    return False


def canon_expiry(raw: str) -> str:
    """Map donate / pick-up / return. Leave any other short note unchanged."""
    text = (raw or "").strip()
    if not text:
        return ""
    key = re.sub(r"[\s_]+", "-", text.lower())
    compact = re.sub(r"[^a-z]", "", text.lower())
    if key in _EXPIRY_ALIASES:
        return _EXPIRY_ALIASES[key]
    if compact in _EXPIRY_ALIASES:
        return _EXPIRY_ALIASES[compact]
    return text
