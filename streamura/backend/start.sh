#!/bin/bash

# Streamura Backend Start Script
# Sets up environment and starts the FastAPI server

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment from .env file
export $(grep -v '^#' .env | xargs 2>/dev/null)

# Override DATABASE_URL to use SQLite for development
export DATABASE_URL="sqlite:///./streamura.db"

# Ensure JWT_SECRET is set (at least 32 chars).
# Do NOT hardcode a real secret here — generate an ephemeral dev secret so no
# usable key lives in the repo. Set JWT_SECRET in .env for stable sessions /
# production (tokens issued with an ephemeral secret are invalidated on restart).
if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    echo "⚠️  JWT_SECRET unset or <32 chars — generating an EPHEMERAL dev secret."
    echo "    Set JWT_SECRET in backend/.env for stable sessions and production."
    export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))' 2>/dev/null || openssl rand -base64 48 | tr -d '\n')"
fi

# Set PYTHONPATH to BOTH parent (for "backend.x" package imports) and
# backend/ itself (for bare "from ranking import X" calls scattered through api.py).
BACKEND_DIR="$(pwd)"
cd ..
export PYTHONPATH="$(pwd):$BACKEND_DIR"

# Start from parent directory as package
PORT=${PORT:-8001}
echo "Starting Streamura backend on port $PORT..."
python -m uvicorn backend.main:app --host ${HOST:-0.0.0.0} --port $PORT --reload
