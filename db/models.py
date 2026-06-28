"""Modello SQLAlchemy dello schema eventi unificato (terremoti + vulcani).

La tabella `events` rappresenta sia i terremoti (USGS) sia i vulcani (GVP) in un
solo schema. La colonna geografica `geom` (PostGIS `geography(Point,4326)`) è
**derivata** da `lat`/`lon` tramite un trigger di DB (vedi la prima migrazione e
`docs/SCHEMA_EVENTI.md`): chi scrive (ETL upsert) imposta solo `lat`/`lon`, il DB
mantiene `geom` coerente.
"""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, DateTime, Enum, Float, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Valori ammessi (allineati con il modello Pydantic in `api/schemas.py`).
SOURCES = ("usgs", "gvp")
EVENT_TYPES = ("earthquake", "volcano")

# Enum nativi Postgres (nome esplicito per riferirli nelle migrazioni).
source_enum = Enum(*SOURCES, name="source_enum")
event_type_enum = Enum(*EVENT_TYPES, name="event_type_enum")


class Base(DeclarativeBase):
    pass


class Event(Base):
    """Evento geo-tettonico unificato."""

    __tablename__ = "events"

    # Chiave deterministica per l'idempotenza dell'ETL (es. "usgs:<code>").
    id: Mapped[str] = mapped_column(Text, primary_key=True)

    source: Mapped[str] = mapped_column(source_enum, nullable=False)
    event_type: Mapped[str] = mapped_column(event_type_enum, nullable=False)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Coordinate "grezze" — comode per il frontend, fonte di verità per `geom`.
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)

    # Punto geografico PostGIS, derivato da lat/lon via trigger. Indice GiST creato
    # esplicitamente nella migrazione (spatial_index=False qui per non duplicarlo).
    geom: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    depth_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Metrica normalizzata 0–1 per il rendering (pulse/colore).
    severity: Mapped[float | None] = mapped_column(Float, nullable=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    place: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Campi specifici della sorgente non normalizzati.
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("lat BETWEEN -90 AND 90", name="ck_events_lat_range"),
        CheckConstraint("lon BETWEEN -180 AND 180", name="ck_events_lon_range"),
        CheckConstraint(
            "severity IS NULL OR severity BETWEEN 0 AND 1", name="ck_events_severity_range"
        ),
        Index("ix_events_occurred_at", occurred_at.desc()),
        Index("ix_events_event_type", "event_type"),
        Index("ix_events_geom", "geom", postgresql_using="gist"),
    )

    def __repr__(self) -> str:  # pragma: no cover - utility
        return f"<Event {self.id} {self.event_type} {self.occurred_at:%Y-%m-%dT%H:%M:%SZ}>"
