#!/usr/bin/env python3
"""Append Notion view-page JSON (stdin or file) to inventory_raw.jsonl."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JSONL = ROOT / "inventory_raw.jsonl"
STATE = ROOT / "inventory_export_state.json"


def main() -> None:
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_text()
    else:
        raw = sys.stdin.read()
    data = json.loads(raw)
    results = data.get("results") or []
    with JSONL.open("a") as f:
        for row in results:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    pages = 0
    if STATE.exists():
        try:
            pages = int(json.loads(STATE.read_text()).get("pages_fetched") or 0)
        except Exception:
            pages = 0
    pages += 1
    state = {
        "pages_fetched": pages,
        "has_more": bool(data.get("has_more")),
        "next_cursor": data.get("next_cursor"),
        "raw_lines": sum(1 for _ in JSONL.open()),
        "last_page_rows": len(results),
    }
    STATE.write_text(json.dumps(state, indent=2) + "\n")
    print(json.dumps(state))


if __name__ == "__main__":
    main()
