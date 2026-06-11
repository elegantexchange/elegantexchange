#!/bin/sh
# Wipe mock consignor/inventory data for a fresh go-live.
# Keeps users (login accounts) and Square connection settings.
set -e

DB_NAME="${DB_NAME:-elegantexchange}"

echo "Resetting boutique data in database: ${DB_NAME}"

mongosh "$DB_NAME" --quiet --eval '
const r = {
  consignors: db.consignors.deleteMany({}).deletedCount,
  inventory: db.inventory.deleteMany({}).deletedCount,
  sales: db.sales.deleteMany({}).deletedCount,
  payouts: db.payouts.deleteMany({}).deletedCount,
  square_sync_log: db.square_sync_log.deleteMany({}).deletedCount,
  counters: db.counters.deleteMany({}).deletedCount,
};
printjson(r);
'

echo "Done. Restart the backend (SEED_DEMO must be unset/false so demo data is not reloaded)."
