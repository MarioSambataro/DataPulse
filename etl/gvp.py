"""Smithsonian GVP Weekly Volcanic Activity Report RSS client.

Returns raw XML bytes so the parser can honor the declared ISO-8859-1 encoding.
Transient failures use exponential backoff; permanent client errors fail fast.
"""

from __future__ import annotations

import time

import httpx

from etl.config import GVP_WEEKLY_RSS_URL
from etl.logging_setup import get_logger

logger = get_logger("etl.gvp")

# Retry rate limiting and transient server failures.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def fetch_weekly_report(
    *,
    url: str = GVP_WEEKLY_RSS_URL,
    timeout: float = 30.0,
    retries: int = 3,
    backoff: float = 2.0,
    client: httpx.Client | None = None,
) -> bytes:
    """Fetch and return the raw Weekly Volcanic Activity Report XML bytes."""
    owns_client = client is None
    client = client or httpx.Client(timeout=timeout)
    try:
        last_exc: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                resp = client.get(url)
                resp.raise_for_status()
                logger.info(
                    "gvp_fetch_ok",
                    extra={"attempt": attempt, "bytes": len(resp.content), "url": url},
                )
                return resp.content
            except (httpx.HTTPError, httpx.TransportError) as exc:
                last_exc = exc
                status = getattr(getattr(exc, "response", None), "status_code", None)
                # Fail immediately for permanent client errors.
                if status is not None and status not in _RETRYABLE_STATUS:
                    logger.error("gvp_fetch_failed", extra={"status": status})
                    raise
                if attempt < retries:
                    sleep_for = backoff ** (attempt - 1)
                    logger.warning(
                        "gvp_fetch_retry",
                        extra={"attempt": attempt, "status": status, "sleep": sleep_for},
                    )
                    time.sleep(sleep_for)
        assert last_exc is not None  # retries is always at least one
        logger.error("gvp_fetch_exhausted", extra={"retries": retries})
        raise last_exc
    finally:
        if owns_client:
            client.close()
