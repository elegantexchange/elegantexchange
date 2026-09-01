#!/usr/bin/env python3
"""Append Notion page JSON, skipping URLs already in inventory_raw.jsonl.
Also bumps pages_fetched like append_inventory_page.py.
Usage: python3 append_inventory_page_skip_existing.py /path/to/page.json [page_num]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JSONL = ROOT / "inventory_raw.jsonl"
STATE = ROOT / "inventory_export_state.json"
URLS_FILE = ROOT / "inventory_existing_urls.json"

def load_urls():
    urls = set()
    if URLS_FILE.exists():
        urls.update(json.loads(URLS_FILE.read_text()))
    if JSONL.exists():
        for line in JSONL.open():
            try:
                u = json.loads(line).get("url")
                if u:
                    urls.add(u)
            except Exception:
                pass
    return urls

def main():
    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    results = data.get("results") or []
    urls = load_urls()
    new_rows = []
    for row in results:
        u = row.get("url")
        if u and u in urls:
            continue
        new_rows.append(row)
        if u:
            urls.add(u)
    with JSONL.open("a") as f:
        for row in new_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    URLS_FILE.write_text(json.dumps(sorted(urls)))
    pages = 0
    if STATE.exists():
        try:
            pages = int(json.loads(STATE.read_text()).get("pages_fetched") or 0)
        except Exception:
            pages = 0
    # If page_num provided, set pages_fetched to that; else increment
    if len(sys.argv) > 2:
        pages = int(sys.argv[2])
    else:
        pages += 1
    state = {
        "pages_fetched": pages,
        "has_more": bool(data.get("has_more")),
        "next_cursor": data.get("next_cursor"),
        "raw_lines": sum(1 for _ in JSONL.open()),
        "last_page_rows": len(results),
        "last_page_new_rows": len(new_rows),
        "skipped_existing": len(results) - len(new_rows),
    }
    STATE.write_text(json.dumps(state, indent=2) + "\n")
    print(json.dumps(state))

if __name__ == "__main__":
    main()
