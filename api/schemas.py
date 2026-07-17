"""Shared Pydantic v2 models for the DataPulse API.

`Event` is the public geotectonic-event contract. It exposes coordinates rather
than internal PostGIS geometry and can be built directly from the ORM model.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["usgs", "gvp"]
EventType = Literal["earthquake", "volcano"]


class Event(BaseModel):
    """Unified earthquake or volcano event exposed by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Deterministic key, for example 'usgs:<code>'.")
    source: Source
    event_type: EventType
    occurred_at: datetime = Field(description="Event time in UTC.")

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)

    depth_km: float | None = Field(default=None, description="Depth in kilometres for earthquakes.")
    magnitude: float | None = Field(default=None, description="Magnitude for earthquakes.")
    severity: float | None = Field(
        default=None, ge=0, le=1, description="Normalized 0–1 rendering metric."
    )

    title: str
    place: str | None = None

    meta: dict = Field(default_factory=dict, description="Source-specific fields.")
    ingested_at: datetime | None = None


class EventPage(BaseModel):
    """Paginated `GET /events` response with pagination metadata."""

    items: list[Event]
    total: int = Field(ge=0, description="Total matching events before limit and offset.")
    limit: int = Field(ge=1, description="Requested page size.")
    offset: int = Field(ge=0, description="Requested offset.")


class Status(BaseModel):
    """Database readiness, ingestion freshness, and process status."""

    status: str = Field(description='Either "ok" or "degraded".')
    version: str
    uptime_s: float = Field(ge=0, description="Seconds since the API process started.")
    db: str = Field(description='Either "ok" or "error".')
    last_ingested_at: datetime | None = Field(
        default=None, description="Timestamp of the latest ETL ingestion."
    )
    last_event_age_s: float | None = Field(
        default=None, ge=0, description="Age in seconds of the latest ingested event."
    )
    events_total: int | None = Field(
        default=None, ge=0, description="Total rows in the events table."
    )


class Stats(BaseModel):
    """Rolling event aggregates returned by `GET /stats`."""

    generated_at: datetime = Field(description="UTC calculation time used as the window origin.")
    events_24h: int = Field(ge=0, description="Events of any type within the last 24 hours.")
    events_7d: int = Field(ge=0, description="Events of any type within the last seven days.")
    earthquakes_24h: int = Field(ge=0, description="Earthquakes within the last 24 hours.")
    max_magnitude_24h: float | None = Field(
        default=None, description="Maximum earthquake magnitude in the last 24 hours."
    )
    active_volcanoes_7d: int = Field(
        ge=0, description="Distinct GVP volcanoes with activity in the last seven days."
    )
