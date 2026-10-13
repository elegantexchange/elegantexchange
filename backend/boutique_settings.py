"""Boutique-wide settings (commission split, category discounts)."""

import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from categorize import CATEGORIES

DEFAULT_CONSIGNOR_SPLIT_PCT = 50.0
SETTINGS_ID = "boutique"
SHOP_TZ = ZoneInfo("America/New_York")
MAX_PERCENT_OFF = 90.0


def clamp_split_pct(value) -> float:
    try:
        pct = float(value)
    except (TypeError, ValueError) as e:
        raise ValueError("consignor_split_pct must be a number") from e
    if pct < 0 or pct > 100:
        raise ValueError("consignor_split_pct must be between 0 and 100")
    return round(pct, 2)


def shop_today() -> date:
    return datetime.now(SHOP_TZ).date()


def parse_shop_date(value) -> date:
    try:
        return date.fromisoformat(str(value or "")[:10])
    except ValueError as e:
        raise ValueError("Use a start and end date") from e


def discounted_price(asking_price: float, percent_off: float) -> float:
    cents = int(round(float(asking_price) * 100))
    sale_cents = int(round(cents * (100.0 - float(percent_off)) / 100.0))
    return sale_cents / 100.0


def discount_is_active(discount: dict, today: date | None = None) -> bool:
    today = today or shop_today()
    try:
        start = parse_shop_date(discount.get("starts_on"))
        end = parse_shop_date(discount.get("ends_on"))
    except ValueError:
        return False
    return start <= today <= end


def _ranges_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start <= b_end and b_start <= a_end


def public_discount(discount: dict, today: date | None = None) -> dict:
    return {
        "id": discount["id"],
        "category": discount["category"],
        "percent_off": discount["percent_off"],
        "starts_on": discount["starts_on"],
        "ends_on": discount["ends_on"],
        "active": discount_is_active(discount, today),
    }


def active_discount_for(category: str, discounts: list, today: date | None = None) -> dict | None:
    name = (category or "").strip()
    for discount in discounts or []:
        if discount.get("category") == name and discount_is_active(discount, today):
            return discount
    return None


async def get_settings(db) -> dict:
    doc = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    pct = doc.get("consignor_split_pct", DEFAULT_CONSIGNOR_SPLIT_PCT)
    try:
        pct = clamp_split_pct(pct)
    except ValueError:
        pct = DEFAULT_CONSIGNOR_SPLIT_PCT
    today = shop_today()
    discounts = [public_discount(d, today) for d in (doc.get("discounts") or []) if d.get("id")]
    return {
        "consignor_split_pct": pct,
        "store_split_pct": round(100.0 - pct, 2),
        "discounts": discounts,
    }


async def add_discount(db, category: str, percent_off, starts_on: str, ends_on: str) -> dict:
    name = (category or "").strip()
    if name not in CATEGORIES:
        raise ValueError("Choose a category")
    try:
        pct = float(percent_off)
    except (TypeError, ValueError) as e:
        raise ValueError("Percent off must be a number") from e
    if pct <= 0 or pct > MAX_PERCENT_OFF:
        raise ValueError(f"Percent off must be between 1 and {int(MAX_PERCENT_OFF)}")
    pct = round(pct, 2)
    start = parse_shop_date(starts_on)
    end = parse_shop_date(ends_on)
    if end < start:
        raise ValueError("End date is before the start date")

    doc = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    existing = list(doc.get("discounts") or [])
    for other in existing:
        if other.get("category") != name:
            continue
        try:
            other_start = parse_shop_date(other.get("starts_on"))
            other_end = parse_shop_date(other.get("ends_on"))
        except ValueError:
            continue
        if _ranges_overlap(start, end, other_start, other_end):
            raise ValueError(f"{name} already has a discount covering those dates")

    existing.append(
        {
            "id": str(uuid.uuid4()),
            "category": name,
            "percent_off": pct,
            "starts_on": start.isoformat(),
            "ends_on": end.isoformat(),
        }
    )
    await db.settings.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {
                "discounts": existing,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return await get_settings(db)


async def remove_discount(db, discount_id: str) -> dict:
    doc = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    existing = list(doc.get("discounts") or [])
    kept = [d for d in existing if d.get("id") != discount_id]
    if len(kept) == len(existing):
        raise ValueError("Discount not found")
    await db.settings.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {
                "discounts": kept,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return await get_settings(db)


async def set_consignor_split_pct(db, pct) -> dict:
    pct = clamp_split_pct(pct)
    await db.settings.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {
                "consignor_split_pct": pct,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return await get_settings(db)


async def current_consignor_split_pct(db) -> float:
    settings = await get_settings(db)
    return settings["consignor_split_pct"]


def resolve_consignor_split_pct(item: dict | None = None, consignor: dict | None = None) -> float:
    """Prefer item stamp, then consignor stamp, else legacy 50%.

    House / boutique-owned stock always pays out 0% to a consignor.
    """
    try:
        from house_stock import is_house_item

        if is_house_item(item, consignor):
            return 0.0
    except Exception:
        pass
    for source in (item, consignor):
        if source and source.get("consignor_split_pct") is not None:
            try:
                return clamp_split_pct(source["consignor_split_pct"])
            except ValueError:
                pass
    return DEFAULT_CONSIGNOR_SPLIT_PCT


def split_sale_amount(sale_price: float, consignor_split_pct: float) -> tuple[float, float]:
    """Returns (store_cut, consignor_cut)."""
    price = float(sale_price)
    pct = clamp_split_pct(consignor_split_pct)
    consignor_cut = round(price * (pct / 100.0), 2)
    store_cut = round(price - consignor_cut, 2)
    return store_cut, consignor_cut
