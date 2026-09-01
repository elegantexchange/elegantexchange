# Notion → Elegant Exchange migration

## What’s already ready

- **Consignors:** `notion-consignors.csv` (46 rows from Notion 🪡 consignors)
- **Inventory:** Notion DB has **1,400** rows. Columns already match EE import:
  - `ID` ← consignor id
  - `text ID`
  - `style/description`
  - `rack`
  - `date`
  - `color`
  - `size`
  - `price`
  - `files and media`

## Import order (in the app)

1. Sign in as admin/manager
2. **Consignors** → Import CSV → choose `notion-consignors.csv`
3. **Inventory** → Import CSV → choose your Notion inventory CSV

## Export inventory from Notion (recommended for full 1,400)

1. Open [inventory](https://app.notion.com/p/38ea4a6bf23c80149dc8c9c957253b05)
2. Switch to the **all** view
3. `⋯` (top right of the database) → **Export** → **CSV**
4. Unzip if needed; save the CSV into this folder as `notion-inventory.csv`
5. Import via Inventory → Import CSV

Incomplete rows still import (flagged for review). Rows without a consignor ID are skipped with an error in the import summary.

## Notes

- Photos in Notion `Files & media` often don’t survive CSV export as usable URLs — expect descriptions/racks/prices first; photos can be added later via scan/intake.
- Some Notion rows use `0` or blank as ID, or mistype the consignor id into price (e.g. `2016`) — those show under **Needs review** after import.
- Do **not** commit these CSVs (PII). Keep them local.
