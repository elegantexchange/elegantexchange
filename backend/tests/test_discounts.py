"""Category discounts: dates, overlap, and the price the register should charge."""
from datetime import date

import pytest

from boutique_settings import (
    active_discount_for,
    discount_is_active,
    discounted_price,
)
from categorize import infer_category
from routes.inventory import _norm_category


def test_sweater_is_its_own_category():
    assert _norm_category("Sweaters") == ("Sweaters", True)
    assert _norm_category("sweater") == ("Sweaters", True)
    assert infer_category("Cashmere crewneck sweater") == "Sweaters"
    assert infer_category("Wool cardigan") == "Sweaters"
    assert infer_category("Silk wrap blouse") == "Tops"


def test_discount_is_active_only_inside_the_range():
    deal = {
        "category": "Sweaters",
        "percent_off": 20,
        "starts_on": "2026-10-10",
        "ends_on": "2026-10-12",
    }
    assert discount_is_active(deal, date(2026, 10, 10))
    assert discount_is_active(deal, date(2026, 10, 12))
    assert not discount_is_active(deal, date(2026, 10, 13))


def test_active_discount_matches_category():
    discounts = [
        {
            "category": "Sweaters",
            "percent_off": 20,
            "starts_on": "2026-10-10",
            "ends_on": "2026-10-12",
        }
    ]
    today = date(2026, 10, 11)
    assert active_discount_for("Sweaters", discounts, today)["percent_off"] == 20
    assert active_discount_for("Tops", discounts, today) is None


def test_twenty_percent_off_tag_price():
    assert discounted_price(69, 20) == 55.2
    assert discounted_price(48, 20) == 38.4


def test_add_discount_rejects_bad_dates():
    from boutique_settings import parse_shop_date

    with pytest.raises(ValueError):
        parse_shop_date("next weekend")
