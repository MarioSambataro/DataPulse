"""Accesso al DB per i job ETL: engine + upsert idempotente in `events`.

L'upsert usa `INSERT ... ON CONFLICT (id) DO UPDATE`: rilanciare un job non
duplica le righe, aggiorna quelle esistenti. La colonna `geom` non viene mai
toccata qui — la mantiene il trigger DB a partire da `lat`/`lon`.
"""

from __future__ import annotations

from typing import Any

from db.models import Event
from sqlalchemy import create_engine, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine

from etl.config import database_url

# Colonne aggiornate in caso di conflitto (tutto tranne `id`, `geom`, `ingested_at`).
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
    """Crea un Engine SQLAlchemy (psycopg v3) verso il DB DataPulse."""
    return create_engine(url or database_url(), future=True)


def upsert_events(engine: Engine, records: list[dict[str, Any]]) -> int:
    """Upsert idempotente dei record in `events`. Ritorna il numero di righe inviate.

    `records` deve contenere solo colonne dello schema (vedi `normalize.EVENT_COLUMNS`),
    **senza** `geom`: il trigger `trg_events_sync_geom` la ricalcola a ogni
    insert/update di `lat`/`lon`.
    """
    if not records:
        return 0

    stmt = insert(Event).values(records)
    update_set = {col: getattr(stmt.excluded, col) for col in _UPDATE_COLUMNS}
    # Aggiorna anche il timestamp di ingestione all'ultima scrittura.
    update_set["ingested_at"] = func.now()
    stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=update_set)

    with engine.begin() as conn:
        conn.execute(stmt)
    return len(records)
