"""Configurazione dell'API (CORS).

Mantiene separata la lettura dell'ambiente dal resto dell'app, così è facile da
testare. La normalizzazione di `DATABASE_URL` (psycopg v3) vive invece in
`etl.config.database_url`, riusata da `api.db` per non duplicare la logica.
"""

from __future__ import annotations

import os

# Origin di default per lo sviluppo: il dev server Vite del frontend.
# In produzione l'origin Vercel verrà aggiunto via env (SEZIONE 10), non hard-coded.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5185",
    "http://127.0.0.1:5185",
)


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


def rate_limit_per_minute() -> int:
    """Richieste per minuto per singolo IP (0 = rate limiting disattivato).

    Letta a ogni richiesta (non cache-ata) così i test possono variarla via env
    senza ricostruire l'app. Default prudente per un backend free-tier pubblico.
    """
    try:
        return int(os.environ.get("RATE_LIMIT_PER_MINUTE", "240"))
    except ValueError:
        return 240


def stream_poll_seconds() -> float:
    """Intervallo di polling interno del feed SSE `/events/stream` (secondi)."""
    try:
        return float(os.environ.get("EVENTS_STREAM_POLL_SECONDS", "5"))
    except ValueError:
        return 5.0


def stream_max_lifetime_seconds() -> float:
    """Durata massima di una connessione SSE prima della chiusura lato server.

    Pattern SSE standard: il server chiude periodicamente e l'`EventSource` del
    browser si riconnette da solo (con `Last-Event-ID`/`since` non serve stato).
    Evita connessioni zombie dietro proxy e rende lo stream testabile (i test la
    abbassano via env, così il generatore termina da solo).
    """
    try:
        return float(os.environ.get("EVENTS_STREAM_MAX_LIFETIME_S", "300"))
    except ValueError:
        return 300.0


def deepseek_api_key() -> str | None:
    """API key DeepSeek; se assente gli endpoint `/ai/*` rispondono 503."""
    return os.environ.get("DEEPSEEK_API_KEY") or None


def deepseek_model() -> str:
    """Model ID DeepSeek. Default `deepseek-v4-flash` (i legacy `deepseek-chat`
    sono deprecati dal 2026-07-24)."""
    return os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")


def deepseek_base_url() -> str:
    """Base URL API DeepSeek (OpenAI-compatibile), senza slash finale."""
    return os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
