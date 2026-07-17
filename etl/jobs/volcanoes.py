"""Fetch the GVP weekly report and upsert normalized volcanic activity.

Each deterministic ID represents one volcano in one ISO week. Volcanoes have no
magnitude or depth; rendering severity comes from the report activity category.
"""

from __future__ import annotations

import argparse

from etl import gvp, normalize
from etl.db import get_engine, upsert_events
from etl.logging_setup import configure_logging, get_logger

logger = get_logger("etl.jobs.volcanoes")


def run(*, dry_run: bool = False) -> int:
    """Run ingestion and return the number of normalized volcano records."""
    logger.info("job_start", extra={"dry_run": dry_run})

    xml_bytes = gvp.fetch_weekly_report()

    df = normalize.normalize_weekly_report(xml_bytes)
    records = normalize.to_records(df)

    if dry_run:
        logger.info("job_dry_run", extra={"events": len(records)})
        return len(records)

    engine = get_engine()
    written = upsert_events(engine, records)
    logger.info("job_done", extra={"events": written})
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest GVP volcanoes into events")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and normalize without writing to the database.",
    )
    args = parser.parse_args()

    configure_logging()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
