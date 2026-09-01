"""Smart inventory categorization from description / rack text."""

from __future__ import annotations

import re

CATEGORIES = (
    "Dresses",
    "Tops",
    "Bottoms",
    "Denim",
    "Outerwear",
    "Handbags",
    "Shoes",
    "Accessories",
    "Jewelry",
    "Other",
)

# Ordered rules: first match wins. Use word-boundary regex fragments.
_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "Jewelry",
        (r"necklace", r"earring", r"bracelet", r"\bring\b", r"brooch", r"pendant", r"jewel"),
    ),
    (
        "Shoes",
        (
            r"shoe",
            r"boot",
            r"sneaker",
            r"heel",
            r"sandal",
            r"loafer",
            r"pump",
            r"wedge",
            r"mule",
            r"\bflats?\b",
            r"espadrille",
            r"clog",
        ),
    ),
    (
        "Handbags",
        (
            r"handbag",
            r"purse",
            r"tote",
            r"clutch",
            r"crossbody",
            r"cross[\s-]?body",
            r"shoulder bag",
            r"backpack",
            r"wallet",
            r"\bbags?\b",
        ),
    ),
    (
        "Dresses",
        (r"dress", r"gown", r"romper", r"jumpsuit", r"sundress"),
    ),
    (
        "Outerwear",
        (
            r"coat",
            r"jacket",
            r"blazer",
            r"parka",
            r"trench",
            r"puffer",
            r"windbreaker",
            r"cardigan",
            r"hoodie",
            r"poncho",
            r"cape",
            r"\bvest\b",
        ),
    ),
    (
        "Denim",
        (r"jeans?", r"denim"),
    ),
    (
        "Bottoms",
        (
            r"pants?",
            r"trousers?",
            r"skirt",
            r"shorts?",
            r"leggings?",
            r"culotte",
            r"chino",
            r"capri",
            r"jogger",
            r"sweatpants?",
        ),
    ),
    (
        "Tops",
        (
            r"\btops?\b",
            r"blouse",
            r"shirts?",
            r"\btees?\b",
            r"t[\s-]?shirts?",
            r"sweater",
            r"jumper",
            r"tank",
            r"camisole",
            r"\bcamis?\b",
            r"tunic",
            r"polo",
            r"bodysuit",
            r"crop",
            r"henley",
            r"pullover",
        ),
    ),
    (
        "Accessories",
        (
            r"scarf",
            r"belt",
            r"\bhats?\b",
            r"\bcaps?\b",
            r"glove",
            r"sunglass",
            r"umbrella",
            r"shawl",
            r"\bwrap\b",
        ),
    ),
]


def capitalize_description(text: str) -> str:
    s = (text or "").strip()
    if not s:
        return s
    return s[0].upper() + s[1:]


def infer_category(description: str = "", rack: str = "", current: str = "") -> str:
    """Return a boutique category. Prefer an already-known current value."""
    cur = (current or "").strip()
    if cur in CATEGORIES and cur != "Other":
        return cur

    blob = f"{description or ''} {rack or ''}".lower()
    if not blob.strip():
        return cur if cur in CATEGORIES else "Other"

    for category, patterns in _RULES:
        for pat in patterns:
            if re.search(pat, blob, re.I):
                return category
    return cur if cur in CATEGORIES else "Other"
