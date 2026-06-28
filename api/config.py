"""Configurazione dell'API (CORS).

Mantiene separata la lettura dell'ambiente dal resto dell'app, così è facile da
testare. La normalizzazione di `DATABASE_URL` (psycopg v3) vive invece in
`etl.config.database_url`, riusata da `api.db` per non duplicare la logica.
"""

from __future__ import annotations

import os

# Origin di default per lo sviluppo: il dev server Vite del frontend.
# In produzione l'origin Vercel verrà aggiunto via env (SEZIONE 10), non hard-coded.
DEFAULT_CORS_ORIGINS = ("http://localhost:5173",)


def cors_origins() -> list[str]:
    """Lista di origin consentiti per il CORS.

    Letta da `CORS_ALLOW_ORIGINS` (origin separati da virgola). Se la variabile non
    è impostata si usa il default dev (`http://localhost:5173`). In SEZIONE 10 il
    dominio Vercel di produzione verrà aggiunto valorizzando questa variabile
    d'ambiente sul backend, senza toccare il codice.
    """
    raw = os.environ.get("CORS_ALLOW_ORIGINS")
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
