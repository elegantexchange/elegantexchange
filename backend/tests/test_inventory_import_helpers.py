"""Offline unit tests for inventory CSV import helpers (no live API)."""
import csv
import io

from csv_import_utils import map_headers, parse_money, parse_flexible_date, normalize_external_id
from routes.inventory import (
    _HEADER_ALIASES,
    _TEMPLATE_CSV,
    _compute_item_flags,
    _infer_category_from_rack,
    _norm_category,
    _norm_condition,
    _parse_media,
)


def test_template_headers():
    reader = csv.DictReader(io.StringIO(_TEMPLATE_CSV))
    mapping = map_headers(reader.fieldnames, _HEADER_ALIASES)
    assert mapping["consignor_id"] == "ID"
    assert mapping["description"] == "style/description"
    assert mapping["rack"] == "rack"
    assert mapping["asking_price"] == "price"
    assert mapping["text_id"] == "text ID"
    assert mapping["media"] == "files and media"


def test_notion_inventory_headers():
    headers = [
        "style/description",
        "rack",
        "date",
        "color",
        "size",
        "price",
        "ID",
        "text ID",
        "files and media",
    ]
    mapping = map_headers(headers, _HEADER_ALIASES)
    assert mapping["description"] == "style/description"
    assert mapping["consignor_id"] == "ID"
    assert mapping["rack"] == "rack"
    assert mapping["color"] == "color"
    assert mapping["text_id"] == "text ID"
    assert mapping["media"] == "files and media"
    assert mapping["date_in"] == "date"


def test_normalize_and_parse():
    assert normalize_external_id("2001") == "2001"
    assert normalize_external_id("2007") == "2007"
    assert parse_money("$14.95") == (14.95, True)
    assert parse_money("") == (None, True)
    assert parse_money("nope") == (None, False)
    assert parse_flexible_date("June 1, 2026") == ("2026-06-01", True)
    assert _parse_media("https://a.com/1.jpg; https://a.com/2.jpg") == [
        "https://a.com/1.jpg",
        "https://a.com/2.jpg",
    ]
    assert _infer_category_from_rack("shoes") == "Shoes"
    assert _infer_category_from_rack("jeans rack") == "Denim"
    assert _infer_category_from_rack("gold rack (1)") is None


def test_category_condition_and_flags():
    assert _norm_category("dresses") == ("Dresses", True)
    assert _norm_category("Vintage") == ("Vintage", False)
    assert _norm_condition("like new") == "Like New"
    flags = _compute_item_flags(
        description="",
        category_raw="",
        category_known=False,
        category_inferred=False,
        rack="",
        asking_price=None,
        price_ok=True,
        date_in_raw="",
        date_ok=True,
        consignor_created=True,
    )
    assert "missing_description" in flags
    assert "missing_rack" not in flags
    assert "missing_category" in flags
    assert "missing_price" in flags
    assert "missing_date_in" in flags
    assert "consignor_created" in flags

    flags2 = _compute_item_flags(
        description="Coat",
        category_raw="Vintage",
        category_known=False,
        category_inferred=False,
        rack="gold rack (1)",
        asking_price=None,
        price_ok=False,
        date_in_raw="soon",
        date_ok=False,
        consignor_created=False,
    )
    assert "unknown_category" in flags2
    assert "unparsed_price" in flags2
    assert "unparsed_date_in" in flags2
    assert "missing_rack" not in flags2
