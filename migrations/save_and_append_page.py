#!/usr/bin/env python3
"""Read Notion query JSON from stdin or file; strip Files & media; write page_NNN.json; append.
Usage: python3 save_and_append_page.py 11 < page.json
       python3 save_and_append_page.py 11 page.json
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGES = ROOT / "inventory_pages"
APPEND = ROOT / "append_inventory_page.py"

def strip_row(row):
    return {k: v for k, v in row.items() if k != "Files & media"}

def main():
    page_num = int(sys.argv[1])
    if len(sys.argv) > 2:
        raw = Path(sys.argv[2]).read_text()
    else:
        raw = sys.stdin.read()
    data = json.loads(raw)
    data["results"] = [strip_row(r) for r in (data.get("results") or [])]
    out = PAGES / f"page_{page_num:03d}.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    import subprocess
    r = subprocess.run([sys.executable, str(APPEND), str(out)], capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode:
        print(r.stderr, file=sys.stderr)
        sys.exit(r.returncode)
    print(f"wrote {out} rows={len(data['results'])}")

if __name__ == "__main__":
    main()
