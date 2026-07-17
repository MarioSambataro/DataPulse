"""Database engine and idempotent `events` upserts for ETL jobs.

Upserts update existing deterministic IDs without duplicates. The database
trigger, not ETL, derives `geom` from coordinates.
"""

from __future__ import annotations

from typing import Any

from db.models import Event
from sqlalchemy import create_engine, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine

from etl.config import database_url

# Columns updated on conflict, excluding identity, geometry, and ingestion time.
_UPDATE_COLUMNS = (
    "source",
    "event_type",
    "occurred_at",
    "lat",
    "lon",
    "depth_km",
    "magnitude",
    "severity",
    "title",
    "place",
    "meta",
)


def get_engine(url: str | None = None) -> Engine:
    """Create a psycopg v3 SQLAlchemy engine for DataPulse."""
    return create_engine(url or database_url(), future=True)


def upsert_events(engine: Engine, records: list[dict[str, Any]]) -> int:
    """Idempotently upsert event records and return the number submitted.

    Records contain only public schema columns and omit `geom`, which the
    database trigger recalculates whenever coordinates change.
    """
    if not records:
        return 0

    stmt = insert(Event).values(records)
    update_set = {col: getattr(stmt.excluded, col) for col in _UPDATE_COLUMNS}
    # Record the latest successful write time.
    update_set["ingested_at"] = func.now()
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=update_set)

    with engine.begin() as conn:
        conn.execute(stmt)
    return len(records)
