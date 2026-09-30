from consignor_fields import canon_expiry, format_phone, normalize_phones, present_phones


def test_format_phone_ten_digits():
    assert format_phone("5085550142") == "(508) 555-0142"
    assert format_phone("1-508-555-0142") == "(508) 555-0142"
    assert format_phone("555-0100") == "555-0100"


def test_normalize_phones_primary_and_types():
    phones, primary = normalize_phones(
        [
            {"type": "cell", "number": "5085550142"},
            {"type": "work", "number": "(617) 555-0199"},
            {"type": "home", "number": ""},
        ]
    )
    assert primary == "(508) 555-0142"
    assert phones == [
        {"type": "mobile", "number": "(508) 555-0142"},
        {"type": "work", "number": "(617) 555-0199"},
    ]


def test_present_phones_from_legacy_field():
    doc = {"phone": "508-555-0142"}
    present_phones(doc)
    assert doc["phones"] == [{"type": "mobile", "number": "(508) 555-0142"}]
    assert doc["phone"] == "(508) 555-0142"


def test_canon_expiry():
    assert canon_expiry("Donate") == "donate"
    assert canon_expiry("pick up") == "pick-up"
    assert canon_expiry("pickup") == "pick-up"
    assert canon_expiry("Return") == "return"
    assert canon_expiry("") == ""
    assert canon_expiry("call first") == "call first"
