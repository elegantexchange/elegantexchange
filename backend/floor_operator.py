"""Resolve floor operator from shared shop@ login (X-EE-Operator header)."""

from __future__ import annotations

ALLOWED = {"Youseline", "Johan", "Noah", "Zachary", "Intern"}
SHARED_SHOP_EMAIL = "shop@elegantexchange.co"


def operator_from_request(request) -> str:
    raw = (request.headers.get("X-EE-Operator") or "").strip()
    if raw in ALLOWED:
        return raw
    # Case-insensitive match
    for name in ALLOWED:
        if name.lower() == raw.lower():
            return name
    return ""


def apply_floor_role(user: dict, request) -> dict:
    """Intern presence on the shared shop login uses the associate (retail) role."""
    email = (user.get("email") or "").lower()
    if email != SHARED_SHOP_EMAIL:
        return user
    if operator_from_request(request) != "Intern":
        return user
    if user.get("role") == "retail":
        return user
    return {**user, "role": "retail"}
