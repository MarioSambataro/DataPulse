"""Job ETL terremoti USGS: scarica una finestra temporale e fa upsert in `events`.

Pipeline: USGS GeoJSON -> normalizzazione Pandas -> upsert idempotente.
Idempotente per costruzione (`id = "usgs:<code>"` + `ON CONFLICT DO UPDATE`):
rilanciare il job non crea duplicati.

Uso:
    python -m etl.jobs.earthquakes                 # ultime 24h
    python -m etl.jobs.earthquakes --hours 48      # finestra custom
    python -m etl.jobs.earthquakes --min-magnitude 2.5
    python -m etl.jobs.earthquakes --dry-run       # niente scrittura su DB
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta

from etl import normalize, usgs
from etl.config import DEFAULT_WINDOW_HOURS
from etl.db import get_engine, upsert_events
from etl.logging_setup import configure_logging, get_logger

logger = get_logger("etl.jobs.earthquakes")


def run(
    hours: int = DEFAULT_WINDOW_HOURS,
    *,
    min_magnitude: float | None = None,
    dry_run: bool = False,
) -> int:
    """Esegue il job. Ritorna il numero di eventi normalizzati (=upsertati)."""
    end = datetime.now(UTC)
    start = end - timedelta(hours=hours)
    logger.info(
        "job_start",
        extra={"hours": hours, "min_magnitude": min_magnitude, "dry_run": dry_run},
    )

    geojson = usgs.fetch_earthquakes(start, end, min_magnitude=min_magnitude)
    raw_count = len(geojson.get("features", []))

    df = normalize.normalize_geojson(geojson)
    records = normalize.to_records(df)
    if raw_count != len(records):
        logger.warning(
            "features_dropped",
            extra={"raw": raw_count, "kept": len(records)},
        )

    if dry_run:
        logger.info("job_dry_run", extra={"events": len(records)})
        return len(records)

    engine = get_engine()
    written = upsert_events(engine, records)
    logger.info("job_done", extra={"events": written})
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL terremoti USGS -> tabella events")
    parser.add_argument(
        "--hours",
        type=int,
        default=DEFAULT_WINDOW_HOURS,
        help=f"Ampiezza della finestra temporale in ore (default {DEFAULT_WINDOW_HOURS}).",
    )
    parser.add_argument(
        "--min-magnitude",
        type=float,
        default=None,
        help="Magnitudo minima (filtro lato USGS). Default: nessun filtro.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scarica e normalizza ma non scrive sul DB.",
    )
    args = parser.parse_args()

    configure_logging()
    run(hours=args.hours, min_magnitude=args.min_magnitude, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
