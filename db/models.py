"""SQLAlchemy model for the unified earthquake and volcano schema.

The PostGIS `geom` column is derived from `lat` and `lon` by a database trigger.
Writers provide only canonical coordinates; the database keeps geometry aligned.
See `docs/EVENT_SCHEMA.md` for the complete mapping.
"""

from __future__ import annotations

from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, DateTime, Enum, Float, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Allowed values aligned with the public Pydantic model.
SOURCES = ("usgs", "gvp")
EVENT_TYPES = ("earthquake", "volcano")

# Named native PostgreSQL enums referenced by migrations.
source_enum = Enum(*SOURCES, name="source_enum")
event_type_enum = Enum(*EVENT_TYPES, name="event_type_enum")


class Base(DeclarativeBase):
    pass


class Event(Base):
    """Unified geotectonic event."""

    __tablename__ = "events"

    # Deterministic key used for idempotent ETL upserts.
    id: Mapped[str] = mapped_column(Text, primary_key=True)

    source: Mapped[str] = mapped_column(source_enum, nullable=False)
    event_type: Mapped[str] = mapped_column(event_type_enum, nullable=False)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Canonical coordinates exposed to the frontend and used to derive `geom`.
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)

    # PostGIS point derived by trigger. The migration creates its GiST index.
    geom: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    depth_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    magnitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Normalized 0–1 metric used for rendering size and color.
    severity: Mapped[float | None] = mapped_column(Float, nullable=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    place: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Non-normalized source-specific fields.
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
