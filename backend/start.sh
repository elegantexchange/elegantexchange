#!/bin/sh
set -e
PORT="${PORT:-8080}"
echo "Starting uvicorn on 0.0.0.0:${PORT}"
if [ -n "$MONGO_URL" ]; then
  echo "MONGO_URL set: yes"
else
  echo "MONGO_URL set: NO — set this in Railway Variables"
fi
if [ -n "$DB_NAME" ]; then
  echo "DB_NAME set: yes"
else
  echo "DB_NAME set: NO — set this in Railway Variables"
fi
exec uvicorn server:app --host 0.0.0.0 --port "${PORT}" --timeout-keep-alive 75
