#!/bin/sh
# Entrypoint dell'immagine API DataPulse (SEZIONE 10).
#
# Applica le migrazioni del DB (idempotente) e poi avvia uvicorn.
# Le migrazioni girano qui — e non in un "release/pre-deploy command" — perché su
# Render quei comandi sono disponibili solo sui piani a pagamento. `alembic upgrade
# head` è idempotente (no-op se il DB è già aggiornato), quindi rieseguirlo a ogni
# avvio/restart è sicuro e self-healing. Disattivabile con RUN_MIGRATIONS=0.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] alembic upgrade head ..."
  alembic -c db/alembic.ini upgrade head
else
  echo "[entrypoint] RUN_MIGRATIONS=${RUN_MIGRATIONS} → salto le migrazioni."
fi

echo "[entrypoint] avvio API su :${PORT:-8000}"
exec uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8000}"
