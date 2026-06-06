#!/bin/bash

# Streamura Backend Start Script
# Sets up environment and starts the FastAPI server

cd "$(dirname "$0")"

# Use the venv interpreter directly instead of `source venv/bin/activate`.
# The activate script hardcodes an absolute VIRTUAL_ENV path, so it breaks the
# moment the repo is moved/copied (then `python` resolves to nothing). Calling
# venv/bin/python is relocation-proof.
PYBIN="$(pwd)/venv/bin/python"
if [ ! -x "$PYBIN" ]; then
    echo "❌ venv interpreter not found at $PYBIN — run: python3 -m venv venv && venv/bin/pip install -r requirements.txt"
    exit 1
fi

# Load environment from .env file, but DROP its PORT line: the .env ships
# PORT=8000 (the old Postgres-compose default), which collides with other
# services on this shared box. The intended Streamura backend port is 8001
# and the Vite proxy targets it — so the script default / explicit $PORT wins.
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^PORT=' | xargs 2>/dev/null)
fi

# Override DATABASE_URL to use SQLite for development
export DATABASE_URL="sqlite:///./streamura.db"

# Ensure JWT_SECRET is set (at least 32 chars).
# Do NOT hardcode a real secret here — generate an ephemeral dev secret so no
# usable key lives in the repo. Set JWT_SECRET in .env for stable sessions /
# production (tokens issued with an ephemeral secret are invalidated on restart).
if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  JWT_SECRET unset or <32 chars — generating an EPHEMERAL dev secret."
    echo "    Set JWT_SECRET in backend/.env for stable sessions and production."
    export JWT_SECRET="$("$PYBIN" -c 'import secrets; print(secrets.token_urlsafe(48))' 2>/dev/null || openssl rand -base64 48 | tr -d '\n')"
fi

# Set PYTHONPATH to BOTH parent (for "backend.x" package imports) and
# backend/ itself (for bare "from ranking import X" calls scattered through api.py).
BACKEND_DIR="$(pwd)"
cd ..
export PYTHONPATH="$(pwd):$BACKEND_DIR"

# Start from parent directory as package
PORT=${PORT:-8001}
echo "Starting Streamura backend on port $PORT..."
"$PYBIN" -m uvicorn backend.main:app --host ${HOST:-0.0.0.0} --port $PORT --reload
