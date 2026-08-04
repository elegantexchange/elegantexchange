"""Offline unit tests for AI scan-assist helpers (no live OpenAI calls)."""
import pytest

from ai_scan import (
    ScanAssistError,
    _extract_json,
    normalize_scan_payload,
    require_api_key,
    validate_image,
)


def test_require_api_key_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ScanAssistError) as exc:
        require_api_key()
    assert exc.value.status_code == 503


def test_require_api_key_present(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert require_api_key() == "sk-test"


def test_validate_image_jpeg():
    jpeg = b"\xff\xd8\xff" + b"\x00" * 20
    assert validate_image(jpeg, "image/jpeg", "item image") == "image/jpeg"


def test_validate_image_rejects_empty():
    with pytest.raises(ScanAssistError, match="Missing"):
        validate_image(b"", "image/jpeg", "item image")


def test_validate_image_rejects_huge():
    with pytest.raises(ScanAssistError, match="too large"):
        validate_image(b"\xff\xd8\xff" + b"x" * (9 * 1024 * 1024), "image/jpeg", "tag")


def test_extract_json_plain():
    data = _extract_json('{"description": "Cream bag", "category": "Handbags"}')
    assert data["description"] == "Cream bag"


def test_extract_json_fenced():
    data = _extract_json('```json\n{"description": "Coat"}\n```')
    assert data["description"] == "Coat"


def test_extract_json_invalid():
    with pytest.raises(ScanAssistError) as exc:
        _extract_json("not json at all")
    assert exc.value.status_code == 502


def test_normalize_scan_payload():
    out = normalize_scan_payload(
        {
            "consignor_id": "2001",
            "description": "Cream textured bag",
            "category": "handbags",
            "asking_price": "$14.95",
            "date_in": "June 1, 2026",
            "color": "cream",
            "condition": "like new",
            "confidence": {"description": "high", "consignor_id": "medium"},
            "notes": "Tag slightly blurry",
        }
    )
    assert out["consignor_id"] == "2001"
    assert out["category"] == "Handbags"
    assert out["asking_price"] == 14.95
    assert out["date_in"] == "2026-06-01"
    assert out["condition"] == "Like New"
    assert out["confidence"]["description"] == "high"
    assert "blurry" in out["notes"]


def test_normalize_unknown_category_becomes_other():
    out = normalize_scan_payload({"description": "Thing", "category": "Vintage"})
    assert out["category"] == "Other"
