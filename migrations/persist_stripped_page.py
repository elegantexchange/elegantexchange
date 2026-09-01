#!/usr/bin/env python3
import json, sys, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent
page_num = int(sys.argv[1])
src = Path(sys.argv[2])
data = json.loads(src.read_text())
if isinstance(data, list):
    data = {"results": data, "has_more": True, "next_cursor": sys.argv[3] if len(sys.argv)>3 else None}
data["results"] = [{k:v for k,v in r.items() if k != "Files & media"} for r in data["results"]]
out = ROOT / "inventory_pages" / f"page_{page_num:03d}.json"
out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(subprocess.check_output([sys.executable, str(ROOT/"append_inventory_page.py"), str(out)], text=True))
print(f"wrote {out} rows={len(data['results'])}")
