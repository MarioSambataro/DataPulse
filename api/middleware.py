"""Cross-cutting API middleware for rate limiting, HTTP caching, and metrics.

`RateLimitMiddleware` uses a per-IP in-memory sliding window, appropriate for the
single-worker portfolio deployment. `CacheMiddleware` adds `Cache-Control` and
ETags to small cacheable JSON responses. `MetricsMiddleware` records Prometheus
request counts and latency histograms exposed by `GET /metrics`.
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

# Liveness and observability endpoints must never be rate limited.
RATE_LIMIT_EXEMPT = {"/health", "/status", "/metrics", "/docs", "/openapi.json"}

_WINDOW_SECONDS = 60.0

# Module-level state is safe for the single-process deployment. Tests reset it to
# avoid carrying requests across cases.
_rate_hits: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limiter() -> None:
    """Clear the rate-limit window; intended for test isolation."""
    _rate_hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforce at most `RATE_LIMIT_PER_MINUTE` requests per IP every 60 seconds."""

    @staticmethod
    def _client_key(request: Request) -> str:
        # Behind Render's proxy, the client IP is the first X-Forwarded-For hop.
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
                content={"detail": "Too many requests; try again in a few seconds."},
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        return await call_next(request)


# ---------------------------------------------------------------------------
# HTTP caching (Cache-Control + ETag/304)
# ---------------------------------------------------------------------------

# Only small, semantically cacheable GET responses are eligible.
CACHEABLE_PATHS = {"/events", "/stats"}
CACHE_MAX_AGE_SECONDS = 30


class CacheMiddleware(BaseHTTPMiddleware):
    """Add public cache headers and a deterministic body-based ETag.

    A matching `If-None-Match` receives an empty `304 Not Modified`. Because
    scheduled ETL jobs change the data infrequently, most refreshes can use 304.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if (
            request.method != "GET"
            or request.url.path not in CACHEABLE_PATHS
            or response.status_code != 200
        ):
            return response

        # Consume the small response body; JSON pages are already bounded by MAX_LIMIT.
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
# Prometheus metrics
# ---------------------------------------------------------------------------

HTTP_REQUESTS = Counter(
    "datapulse_http_requests_total",
    "HTTP requests served by the API.",
    labelnames=("method", "path", "status"),
)
HTTP_LATENCY = Histogram(
    "datapulse_http_request_duration_seconds",
    "HTTP request latency.",
    labelnames=("method", "path"),
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Record request count and latency by route template."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - started

        # Route templates keep label cardinality low; unmatched paths share one bucket.
        route = request.scope.get("route")
        path = getattr(route, "path", None) or "<unmatched>"

        HTTP_REQUESTS.labels(request.method, path, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.method, path).observe(elapsed)
        return response
