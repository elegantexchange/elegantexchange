#!/bin/sh
set -e

cd "$(dirname "$0")"

PORT="${PORT:-8000}"
VENV=".venv"

if [ ! -d "$VENV" ]; then
  echo "Creating virtualenv in $VENV…"
  python3 -m venv "$VENV"
fi

# shellcheck disable=SC1091
. "$VENV/bin/activate"

echo "Installing dependencies…"
pip install -q -r requirements-local.txt

echo "Starting backend on http://127.0.0.1:${PORT}"
exec uvicorn server:app --reload --host 0.0.0.0 --port "$PORT"
