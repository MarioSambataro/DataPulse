"""DataPulse FastAPI application.

Serves unified geotectonic events with filtering, pagination, aggregates, live
SSE updates, optional AI assistance, and operational endpoints. Run locally with
`uvicorn api.main:app --reload`; OpenAPI documentation is available at `/docs`.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Annotated

from db.models import Event
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import api
from api.ai import router as ai_router
from api.config import cors_origins
from api.db import get_session
from api.middleware import CacheMiddleware, MetricsMiddleware, RateLimitMiddleware
from api.queries import DEFAULT_LIMIT, MAX_LIMIT, compute_stats, list_events
from api.schemas import EventPage, EventType, Stats, Status
from api.stream import router as stream_router

# Process start time used by the readiness endpoint.
_STARTED_AT_MONOTONIC = time.monotonic()

app = FastAPI(
    title="DataPulse API",
    version=api.__version__,
    description=(
        "Geotectonic monitoring API that unifies USGS seismic events and "
        "Smithsonian GVP volcanic activity with spatial and temporal filters."
    ),
)

# Middleware is applied inside-out: CORS remains outermost so 429 and 304
# responses include its headers, while metrics observe the processed requests.
app.add_middleware(MetricsMiddleware)
app.add_middleware(CacheMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(stream_router)
app.include_router(ai_router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Return process liveness without accessing the database."""
    return {"status": "ok"}


@app.get("/status", response_model=Status, tags=["meta"])
def status(session: Annotated[Session, Depends(get_session)]) -> Status:
    """Report database readiness, data freshness, and process uptime."""
    uptime_s = time.monotonic() - _STARTED_AT_MONOTONIC
    try:
        last_ingested = session.scalar(select(func.max(Event.ingested_at)))
        events_total = session.scalar(select(func.count()).select_from(Event)) or 0
    except Exception:
        return Status(status="degraded", version=api.__version__, uptime_s=uptime_s, db="error")

    age_s: float | None = None
    if last_ingested is not None:
        age_s = max(0.0, (datetime.now(UTC) - last_ingested).total_seconds())
    return Status(
        status="ok",
        version=api.__version__,
        uptime_s=uptime_s,
        db="ok",
        last_ingested_at=last_ingested,
        last_event_age_s=age_s,
        events_total=events_total,
    )


@app.get("/metrics", tags=["meta"], include_in_schema=False)
def metrics() -> Response:
    """Return Prometheus metrics in the text exposition format."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/events", response_model=EventPage, tags=["events"])
def get_events(
    session: Annotated[Session, Depends(get_session)],
    event_type: Annotated[EventType | None, Query(description="Filter by event type.")] = None,
    min_magnitude: Annotated[
        float | None,
        Query(ge=0, description="Minimum magnitude; excludes records with no magnitude."),
    ] = None,
    start: Annotated[datetime | None, Query(description="occurred_at >= start (ISO 8601).")] = None,
    end: Annotated[datetime | None, Query(description="occurred_at <= end (ISO 8601).")] = None,
    min_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    max_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    min_lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    max_lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    near_lat: Annotated[
        float | None, Query(ge=-90, le=90, description="Proximity centre latitude.")
    ] = None,
    near_lon: Annotated[
        float | None, Query(ge=-180, le=180, description="Proximity centre longitude.")
    ] = None,
    radius_km: Annotated[
        float | None, Query(gt=0, description="Proximity radius in kilometres (ST_DWithin).")
    ] = None,
    order: Annotated[
        str, Query(pattern="^(asc|desc)$", description="Sort order for occurred_at.")
    ] = "desc",
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventPage:
    """Return filtered, paginated events ordered by `occurred_at`.

    Proximity parameters must be supplied together. Bounding-box minima cannot
    exceed their corresponding maxima; inconsistent parameters return 422.
    """
    near = (near_lat, near_lon, radius_km)
    if any(v is not None for v in near) and any(v is None for v in near):
        raise HTTPException(
            status_code=422,
            detail="near_lat, near_lon, and radius_km must be provided together or omitted.",
        )
    if min_lat is not None and max_lat is not None and min_lat > max_lat:
        raise HTTPException(status_code=422, detail="min_lat cannot exceed max_lat.")
    if min_lon is not None and max_lon is not None and min_lon > max_lon:
        raise HTTPException(status_code=422, detail="min_lon cannot exceed max_lon.")

    rows, total = list_events(
        session,
        event_type=event_type,
        min_magnitude=min_magnitude,
        start=start,
        end=end,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        near_lat=near_lat,
        near_lon=near_lon,
        radius_km=radius_km,
        order=order,
        limit=limit,
        offset=offset,
    )
    return EventPage(items=rows, total=total, limit=limit, offset=offset)


@app.get("/stats", response_model=Stats, tags=["stats"])
def get_stats(session: Annotated[Session, Depends(get_session)]) -> Stats:
    """Return rolling 24-hour and 7-day event statistics."""
    return Stats(**compute_stats(session))
