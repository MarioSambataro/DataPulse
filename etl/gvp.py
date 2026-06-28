"""Client del Weekly Volcanic Activity Report dello Smithsonian GVP (feed RSS).

Scarica il report settimanale come **bytes** grezzi (XML in ISO-8859-1): la
trasformazione vive in `etl.normalize`. Gestisce timeout e retry con backoff
esponenziale su errori di rete e risposte 5xx/429 (transitorie), stesso stile di
`etl.usgs`. I 4xx "veri" (es. 404) falliscono subito.

Si ritornano i bytes (non `resp.text`) così il parser XML può rispettare la
dichiarazione di encoding del documento ed evitare mojibake sugli accenti.
"""

from __future__ import annotations

import time

import httpx

from etl.config import GVP_WEEKLY_RSS_URL
from etl.logging_setup import get_logger

logger = get_logger("etl.gvp")

# Status che vale la pena ritentare (rate limit + errori server transitori).
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def fetch_weekly_report(
    *,
    url: str = GVP_WEEKLY_RSS_URL,
    timeout: float = 30.0,
    retries: int = 3,
    backoff: float = 2.0,
    client: httpx.Client | None = None,
) -> bytes:
    """Scarica il feed RSS del Weekly Volcanic Activity Report.

    Ritorna il corpo XML grezzo (bytes). Solleva l'ultima eccezione httpx se
    tutti i tentativi falliscono.
    """
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
                # Non ritentare i 4xx "veri" (es. 404): inutile.
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
        assert last_exc is not None  # i retry sono >= 1
        logger.error("gvp_fetch_exhausted", extra={"retries": retries})
        raise last_exc
    finally:
        if owns_client:
            client.close()
