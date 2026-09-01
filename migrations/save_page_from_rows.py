#!/usr/bin/env python3
"""Assemble page JSON from a rows JSON array file + cursor metadata."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
rows_path = Path(sys.argv[1])
page_num = int(sys.argv[2])
has_more = sys.argv[3].lower() == "true"
next_cursor = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "null" else None

rows = json.loads(rows_path.read_text())
# Strip Files & media (not useful for import; user said ignore photos)
for r in rows:
    r.pop("Files & media", None)

payload = {"results": rows, "has_more": has_more, "next_cursor": next_cursor}
out = ROOT / "inventory_pages" / f"page_{page_num:03d}.json"
out.write_text(json.dumps(payload, ensure_ascii=False))
print(f"wrote {out} rows={len(rows)}")

import subprocess
r = subprocess.run([sys.executable, str(ROOT / "append_inventory_page.py"), str(out)], capture_output=True, text=True)
print(r.stdout.strip())
sys.exit(r.returncode)
