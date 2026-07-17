"""Environment-backed API configuration.

Environment access is isolated for straightforward testing. `DATABASE_URL`
normalization lives in `etl.config.database_url` and is reused by `api.db`.
"""

from __future__ import annotations

import os

# Default development origins for the Vite frontend. Production origins are
# supplied through the environment rather than hard-coded.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5185",
    "http://127.0.0.1:5185",
)


def cors_origins() -> list[str]:
    """Return CORS origins from a comma-separated environment variable.

    Development origins are used when `CORS_ALLOW_ORIGINS` is unset. Production
    supplies the exact Vercel origin through the backend environment.
    """
    raw = os.environ.get("CORS_ALLOW_ORIGINS")
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def rate_limit_per_minute() -> int:
    """Return requests per minute per IP; zero disables rate limiting.

    The value is read for every request so tests can change it without rebuilding
    the app. The default is conservative for a public free-tier backend.
    """
    try:
        return int(os.environ.get("RATE_LIMIT_PER_MINUTE", "240"))
    except ValueError:
        return 240


def stream_poll_seconds() -> float:
    """Return the internal SSE database polling interval in seconds."""
    try:
        return float(os.environ.get("EVENTS_STREAM_POLL_SECONDS", "5"))
    except ValueError:
        return 5.0


def stream_max_lifetime_seconds() -> float:
    """Return the maximum lifetime of one server-side SSE connection.

    Periodic closure lets the browser reconnect automatically, avoids zombie
    proxy connections, and makes the stream generator testable.
    """
    try:
        return float(os.environ.get("EVENTS_STREAM_MAX_LIFETIME_S", "300"))
    except ValueError:
        return 300.0


def deepseek_api_key() -> str | None:
    """Return the DeepSeek API key; AI endpoints return 503 when it is absent."""
    return os.environ.get("DEEPSEEK_API_KEY") or None


def deepseek_model() -> str:
    """Return the DeepSeek model ID, defaulting to `deepseek-v4-flash`."""
    return os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")


def deepseek_base_url() -> str:
    """Return the OpenAI-compatible DeepSeek base URL without a trailing slash."""
    return os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
