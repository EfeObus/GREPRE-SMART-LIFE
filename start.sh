#!/bin/sh
# Start script for Cloud Run / Railway
# Uses PORT env variable if set, otherwise defaults to 8080

PORT="${PORT:-8080}"
echo "Starting server on port $PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
