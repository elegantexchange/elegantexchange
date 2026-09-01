"""Resolve floor operator from shared shop@ login (X-EE-Operator header)."""

from __future__ import annotations

ALLOWED = {"Youseline", "Johan", "Noah", "Zachary"}


def operator_from_request(request) -> str:
    raw = (request.headers.get("X-EE-Operator") or "").strip()
    if raw in ALLOWED:
        return raw
    # Case-insensitive match
    for name in ALLOWED:
        if name.lower() == raw.lower():
            return name
    return ""
