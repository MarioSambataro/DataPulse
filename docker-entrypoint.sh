#!/bin/sh
# DataPulse API image entrypoint.
#
# Apply idempotent database migrations before starting Uvicorn. Render reserves
# pre-deploy commands for paid plans, so startup migrations provide the free-tier
# equivalent. Set RUN_MIGRATIONS=0 to disable them.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] alembic upgrade head ..."
  alembic -c db/alembic.ini upgrade head
else
  echo "[entrypoint] RUN_MIGRATIONS=${RUN_MIGRATIONS} → salto le migrazioni."
fi

echo "[entrypoint] starting API on :${PORT:-8000}"
exec uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8000}"
