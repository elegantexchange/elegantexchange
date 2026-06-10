#!/bin/sh
set -e
PORT="${PORT:-8080}"
echo "Starting uvicorn on 0.0.0.0:${PORT}"
exec uvicorn server:app --host 0.0.0.0 --port "${PORT}"
