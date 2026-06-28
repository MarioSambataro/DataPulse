"""Configurazione condivisa dei job ETL.

Centralizza: lettura/normalizzazione di `DATABASE_URL` (psycopg v3) e le costanti
della sorgente USGS. Volutamente privo di dipendenze pesanti (niente pandas/httpx)
così è importabile anche nei test offline.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Endpoint pubblico della USGS Earthquake API (GeoJSON, niente API key).
USGS_QUERY_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

# Finestra temporale di default del job terremoti (in ore). Decisione SEZIONE 3:
# 24h copre abbondantemente la cadenza oraria dello scheduling (SEZIONE 5), con
# margine per recuperare run saltati. Parametrizzabile via CLI (--hours).
DEFAULT_WINDOW_HOURS = 24

# Carica `.env` dalla root del repo (etl/ -> ..) una sola volta all'import.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def database_url() -> str:
    """Ritorna la `DATABASE_URL` normalizzata al driver psycopg v3.

    Il `.env` contiene una URL `postgresql://...` (valida anche per docker-compose);
    SQLAlchemy/psycopg vogliono `postgresql+psycopg://...`.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL non impostata. Copia .env.example in .env "
            "(o esporta la variabile) prima di lanciare i job ETL."
        )
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url
