"""DataPulse API — FastAPI.

Espone gli eventi geo-tettonici unificati (terremoti USGS + vulcani GVP) con
filtri, paginazione e aggregati. Avvio: `uvicorn api.main:app --reload`.
OpenAPI/Swagger su `/docs`.

Contratto:
  - `GET /events`  → envelope paginato `EventPage` (items + total/limit/offset).
  - `GET /stats`   → aggregati `Stats` (finestre rolling 24h/7g).
  - `GET /health`  → liveness check.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import api
from api.config import cors_origins
from api.db import get_session
from api.queries import DEFAULT_LIMIT, MAX_LIMIT, compute_stats, list_events
from api.schemas import EventPage, EventType, Stats

app = FastAPI(
    title="DataPulse API",
    version=api.__version__,
    description=(
        "Console di monitoraggio geo-tettonico: eventi sismici (USGS) e vulcanici "
        "(GVP) in uno schema unificato, con filtri spaziali/temporali e aggregati."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness check (non tocca il DB)."""
    return {"status": "ok"}


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
