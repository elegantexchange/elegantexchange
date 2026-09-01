"""Boutique-wide settings (commission split, etc.)."""

from datetime import datetime, timezone

DEFAULT_CONSIGNOR_SPLIT_PCT = 50.0
SETTINGS_ID = "boutique"


def clamp_split_pct(value) -> float:
    try:
        pct = float(value)
    except (TypeError, ValueError) as e:
        raise ValueError("consignor_split_pct must be a number") from e
    if pct < 0 or pct > 100:
        raise ValueError("consignor_split_pct must be between 0 and 100")
    return round(pct, 2)


async def get_settings(db) -> dict:
    doc = await db.settings.find_one({"_id": SETTINGS_ID}) or {}
    pct = doc.get("consignor_split_pct", DEFAULT_CONSIGNOR_SPLIT_PCT)
    try:
        pct = clamp_split_pct(pct)
    except ValueError:
        pct = DEFAULT_CONSIGNOR_SPLIT_PCT
    return {
        "consignor_split_pct": pct,
        "store_split_pct": round(100.0 - pct, 2),
    }


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
