"""DataPulse API — FastAPI.

Espone gli eventi geo-tettonici unificati (terremoti USGS + vulcani GVP) con
filtri, paginazione e aggregati. Avvio: `uvicorn api.main:app --reload`.
OpenAPI/Swagger su `/docs`.

Contratto:
  - `GET /events`         → envelope paginato `EventPage` (items + total/limit/offset).
  - `GET /events/stream`  → feed live SSE dei nuovi eventi ingeriti (api.stream).
  - `GET /stats`          → aggregati `Stats` (finestre rolling 24h/7g).
  - `POST /ai/query`      → linguaggio naturale → filtri (DeepSeek, api.ai).
  - `GET /ai/briefing`    → bollettino sintetico generato dai dati (DeepSeek, api.ai).
  - `GET /health`         → liveness check (non tocca il DB).
  - `GET /status`         → readiness: DB, freschezza dati, uptime.
  - `GET /metrics`        → metriche Prometheus.

Trasversali (api.middleware): rate limiting per IP, Cache-Control+ETag su
/events e /stats, contatori/latenze Prometheus.
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

# Istante di avvio del processo (per l'uptime esposto da /status).
_STARTED_AT_MONOTONIC = time.monotonic()

app = FastAPI(
    title="DataPulse API",
    version=api.__version__,
    description=(
        "Console di monitoraggio geo-tettonico: eventi sismici (USGS) e vulcanici "
        "(GVP) in uno schema unificato, con filtri spaziali/temporali e aggregati."
    ),
)

# Ordine middleware (l'ultimo aggiunto è il più esterno): CORS avvolge tutto
# (anche 429/304 devono avere gli header CORS), poi il rate limit taglia presto,
# la cache riscrive solo /events e /stats, le metriche misurano ciò che passa.
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
    """Liveness check (non tocca il DB)."""
    return {"status": "ok"}


@app.get("/status", response_model=Status, tags=["meta"])
def status(session: Annotated[Session, Depends(get_session)]) -> Status:
    """Readiness + freschezza dati: DB raggiungibile, età dell'ultima ingestione ETL."""
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
    """Metriche Prometheus (testo, formato exposition)."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/events", response_model=EventPage, tags=["events"])
def get_events(
    session: Annotated[Session, Depends(get_session)],
    event_type: Annotated[EventType | None, Query(description="Filtra per tipo evento.")] = None,
    min_magnitude: Annotated[
        float | None,
        Query(ge=0, description="Magnitudo minima (esclude i record senza magnitudo)."),
    ] = None,
    start: Annotated[datetime | None, Query(description="occurred_at >= start (ISO 8601).")] = None,
    end: Annotated[datetime | None, Query(description="occurred_at <= end (ISO 8601).")] = None,
    min_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    max_lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    min_lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    max_lon: Annotated[float | None, Query(ge=-180, le=180)] = None,
    near_lat: Annotated[float | None, Query(ge=-90, le=90, description="Centro vicinanza.")] = None,
    near_lon: Annotated[
        float | None, Query(ge=-180, le=180, description="Centro vicinanza.")
    ] = None,
    radius_km: Annotated[
        float | None, Query(gt=0, description="Raggio vicinanza in km (ST_DWithin).")
    ] = None,
    order: Annotated[
        str, Query(pattern="^(asc|desc)$", description="Ordine per occurred_at.")
    ] = "desc",
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventPage:
    """Eventi filtrati e paginati, ordinati per `occurred_at` (default DESC).

    Coerenza parametri (422 se violata):
      - vicinanza: `near_lat`, `near_lon`, `radius_km` vanno forniti **tutti e tre o nessuno**;
      - bounding box: se presenti entrambi, `min_lat <= max_lat` e `min_lon <= max_lon`.
    """
    near = (near_lat, near_lon, radius_km)
    if any(v is not None for v in near) and any(v is None for v in near):
        raise HTTPException(
            status_code=422,
            detail="near_lat, near_lon e radius_km vanno forniti tutti e tre insieme (o nessuno).",
        )
    if min_lat is not None and max_lat is not None and min_lat > max_lat:
        raise HTTPException(status_code=422, detail="min_lat non può superare max_lat.")
    if min_lon is not None and max_lon is not None and min_lon > max_lon:
        raise HTTPException(status_code=422, detail="min_lon non può superare max_lon.")

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
    """Aggregati: conteggi 24h/7g, magnitudo massima 24h, vulcani attivi 7g.

    Le finestre sono **rolling** rispetto a `generated_at` (now UTC del DB).
    """
    return Stats(**compute_stats(session))
