#!/bin/sh
# Wipe mock consignor/inventory data for a fresh go-live.
# Keeps users (login accounts) and Square connection settings.
set -e

DB_NAME="${DB_NAME:-elegantexchange}"
MONGO="${MONGO_URL:-mongodb://localhost:27017/${DB_NAME}}"

echo "Resetting boutique data in database: ${DB_NAME}"

mongosh "$MONGO" --quiet --eval "
const r = {
  consignors: db.getSiblingDB('${DB_NAME}').consignors.deleteMany({}).deletedCount,
  inventory: db.getSiblingDB('${DB_NAME}').inventory.deleteMany({}).deletedCount,
  sales: db.getSiblingDB('${DB_NAME}').sales.deleteMany({}).deletedCount,
  payouts: db.getSiblingDB('${DB_NAME}').payouts.deleteMany({}).deletedCount,
  square_sync_log: db.getSiblingDB('${DB_NAME}').square_sync_log.deleteMany({}).deletedCount,
  counters: db.getSiblingDB('${DB_NAME}').counters.deleteMany({}).deletedCount,
};
printjson(r);
"

echo "Done. Restart the backend (SEED_DEMO must be unset/false so demo data is not reloaded)."
