"""Client della USGS Earthquake API (GeoJSON, near-real-time, senza API key).

Scarica una finestra temporale di terremoti. Gestisce timeout e retry con backoff
esponenziale su errori di rete e risposte 5xx/429 (transitorie). Non normalizza
nulla: ritorna il GeoJSON grezzo (dict), la trasformazione vive in `etl.normalize`.
"""

from __future__ import annotations

import time
from datetime import datetime

import httpx

from etl.config import USGS_QUERY_URL
from etl.logging_setup import get_logger

logger = get_logger("etl.usgs")

# Status che vale la pena ritentare (rate limit + errori server transitori).
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def fetch_earthquakes(
    start: datetime,
    end: datetime,
    *,
    min_magnitude: float | None = None,
    timeout: float = 30.0,
    retries: int = 3,
    backoff: float = 2.0,
    client: httpx.Client | None = None,
) -> dict:
    """Scarica i terremoti nell'intervallo [start, end] dalla USGS API.

    `start`/`end` devono essere datetime UTC (aware). Ritorna il dict GeoJSON
    (`FeatureCollection`). Solleva l'ultima eccezione httpx se tutti i tentativi
    falliscono.
    """
    params: dict[str, object] = {
        "format": "geojson",
        "starttime": start.isoformat(),
        "endtime": end.isoformat(),
        "orderby": "time",
    }
    if min_magnitude is not None:
        params["minmagnitude"] = min_magnitude

    owns_client = client is None
    client = client or httpx.Client(timeout=timeout)
    try:
        last_exc: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                resp = client.get(USGS_QUERY_URL, params=params)
                if resp.status_code in _RETRYABLE_STATUS:
                    resp.raise_for_status()
                resp.raise_for_status()
                payload = resp.json()
                logger.info(
                    "usgs_fetch_ok",
                    extra={
                        "attempt": attempt,
                        "count": len(payload.get("features", [])),
                        "starttime": params["starttime"],
                        "endtime": params["endtime"],
                    },
                )
                return payload
            except (httpx.HTTPError, httpx.TransportError) as exc:
                last_exc = exc
                status = getattr(getattr(exc, "response", None), "status_code", None)
                # Non ritentare i 4xx "veri" (es. 400 parametri errati): inutile.
                if status is not None and status not in _RETRYABLE_STATUS:
                    logger.error("usgs_fetch_failed", extra={"status": status})
                    raise
                if attempt < retries:
                    sleep_for = backoff ** (attempt - 1)
                    logger.warning(
                        "usgs_fetch_retry",
                        extra={"attempt": attempt, "status": status, "sleep": sleep_for},
                    )
                    time.sleep(sleep_for)
        assert last_exc is not None  # i retry sono >= 1
        logger.error("usgs_fetch_exhausted", extra={"retries": retries})
        raise last_exc
    finally:
        if owns_client:
            client.close()
