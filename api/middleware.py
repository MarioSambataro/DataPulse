"""Middleware trasversali dell'API: rate limiting, caching HTTP, metriche.

Tre preoccupazioni "da API pubblica" tenute fuori dagli handler:

  - `RateLimitMiddleware` — sliding window in-memory per IP (nessuna dipendenza
    esterna; per un deploy multi-processo servirebbe uno store condiviso, scelta
    documentata e accettata per un backend free-tier single-worker).
  - `CacheMiddleware` — `Cache-Control` + `ETag` (con 304 su `If-None-Match`)
    sulle sole risposte JSON piccole e cacheabili (`/events`, `/stats`).
    Il feed SSE `/events/stream` NON passa dal buffering (path escluso).
  - `MetricsMiddleware` — contatore richieste + istogramma latenza Prometheus,
    esposti da `GET /metrics` (vedi `api.main`).
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque

from prometheus_client import Counter, Histogram
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from api.config import rate_limit_per_minute

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

# Path esenti: liveness/observability non devono mai finire in 429.
RATE_LIMIT_EXEMPT = {"/health", "/status", "/metrics", "/docs", "/openapi.json"}

_WINDOW_SECONDS = 60.0

# Stato condiviso a livello di modulo (l'app è un singleton di processo); i test
# lo azzerano con `reset_rate_limiter()` per non ereditare hit dai test precedenti.
_rate_hits: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limiter() -> None:
    """Svuota la finestra del rate limiter (uso nei test)."""
    _rate_hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window per IP: al più `RATE_LIMIT_PER_MINUTE` richieste/60s."""

    @staticmethod
    def _client_key(request: Request) -> str:
        # Dietro proxy (Render) l'IP reale è il primo hop di X-Forwarded-For.
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        limit = rate_limit_per_minute()
        if limit <= 0 or request.url.path in RATE_LIMIT_EXEMPT:
            return await call_next(request)

        now = time.monotonic()
        hits = _rate_hits[self._client_key(request)]
        while hits and now - hits[0] > _WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = max(1, int(_WINDOW_SECONDS - (now - hits[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Troppe richieste: riprova tra qualche secondo."},
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        return await call_next(request)


# ---------------------------------------------------------------------------
# Caching HTTP (Cache-Control + ETag/304)
# ---------------------------------------------------------------------------

# Solo endpoint GET con body JSON piccolo e semanticamente cacheabile.
CACHEABLE_PATHS = {"/events", "/stats"}
CACHE_MAX_AGE_SECONDS = 30


class CacheMiddleware(BaseHTTPMiddleware):
    """`Cache-Control: public, max-age` + `ETag` deterministica sul body.

    L'ETag è l'hash del payload: se il client rimanda `If-None-Match` identico
    si risponde `304 Not Modified` senza body (i dati cambiano solo quando i
    cron ETL scrivono, quindi la maggior parte dei refresh è una 304).
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if (
            request.method != "GET"
            or request.url.path not in CACHEABLE_PATHS
            or response.status_code != 200
        ):
            return response

        # Consuma lo stream (body piccolo: pagine JSON già limitate da MAX_LIMIT).
        body = b"".join([chunk async for chunk in response.body_iterator])
        etag = f'W/"{hashlib.sha256(body).hexdigest()[:32]}"'

        headers = dict(response.headers)
        headers["ETag"] = etag
        headers["Cache-Control"] = f"public, max-age={CACHE_MAX_AGE_SECONDS}"

        if request.headers.get("if-none-match") == etag:
            headers.pop("content-length", None)
            return Response(status_code=304, headers=headers)

        return Response(
            content=body,
            status_code=200,
            headers=headers,
            media_type=response.media_type,
        )


# ---------------------------------------------------------------------------
# Metriche Prometheus
# ---------------------------------------------------------------------------

HTTP_REQUESTS = Counter(
    "datapulse_http_requests_total",
    "Richieste HTTP servite dall'API.",
    labelnames=("method", "path", "status"),
)
HTTP_LATENCY = Histogram(
    "datapulse_http_request_duration_seconds",
    "Latenza delle richieste HTTP.",
    labelnames=("method", "path"),
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Registra contatore e latenza per route (template, non URL grezzo)."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - started

        # Il template della route ("/events") tiene bassa la cardinalità delle
        # label; per i path non instradati (404) si usa un bucket unico.
        route = request.scope.get("route")
        path = getattr(route, "path", None) or "<unmatched>"

        HTTP_REQUESTS.labels(request.method, path, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.method, path).observe(elapsed)
        return response
