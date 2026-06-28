"""Job ETL vulcani GVP: scarica il Weekly Volcanic Activity Report e fa upsert in `events`.

Pipeline: feed RSS Smithsonian/USGS -> normalizzazione Pandas -> upsert idempotente.
Cadenza **settimanale**: ogni evento è "il vulcano X nella settimana W". Idempotente
per costruzione (`id = "gvp:<volcano_number>:<week_iso>"` + `ON CONFLICT DO UPDATE`):
rilanciare il job nella stessa settimana non crea duplicati.

I vulcani non hanno magnitudo né profondità (magnitude/depth_km = null); la severity
deriva dalla categoria di attività del report (vedi `normalize.severity_from_activity`).

Uso:
    python -m etl.jobs.volcanoes              # report della settimana corrente
    python -m etl.jobs.volcanoes --dry-run    # scarica e normalizza, niente DB
"""

from __future__ import annotations

import argparse

from etl import gvp, normalize
from etl.db import get_engine, upsert_events
from etl.logging_setup import configure_logging, get_logger

logger = get_logger("etl.jobs.volcanoes")


def run(*, dry_run: bool = False) -> int:
    """Esegue il job. Ritorna il numero di vulcani normalizzati (=upsertati)."""
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
    parser = argparse.ArgumentParser(description="ETL vulcani GVP -> tabella events")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scarica e normalizza ma non scrive sul DB.",
    )
    args = parser.parse_args()

    configure_logging()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
