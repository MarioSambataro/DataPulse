"""Fetch USGS earthquakes, normalize them, and upsert deterministic event IDs.

Usage:
    python -m etl.jobs.earthquakes
    python -m etl.jobs.earthquakes --hours 48
    python -m etl.jobs.earthquakes --min-magnitude 2.5
    python -m etl.jobs.earthquakes --dry-run
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
    """Run ingestion and return the number of normalized events."""
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
    parser = argparse.ArgumentParser(description="Ingest USGS earthquakes into events")
    parser.add_argument(
        "--hours",
        type=int,
        default=DEFAULT_WINDOW_HOURS,
        help=f"Source time window in hours (default: {DEFAULT_WINDOW_HOURS}).",
    )
    parser.add_argument(
        "--min-magnitude",
        type=float,
        default=None,
        help="Minimum magnitude sent to USGS; default: no filter.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and normalize without writing to the database.",
    )
    args = parser.parse_args()

    configure_logging()
    run(hours=args.hours, min_magnitude=args.min_magnitude, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
