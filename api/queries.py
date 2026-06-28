"""Costruzione delle query SQLAlchemy per gli endpoint dell'API.

Tenuta separata da `api.main` così la logica di filtro/ordinamento è isolata e
testabile. Tutte le funzioni lavorano sull'ORM `db.models.Event` (con `geom`); la
serializzazione verso il contratto pubblico (`api.schemas.Event`, senza `geom`) la
fa FastAPI col `response_model`.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from db.models import Event
from geoalchemy2 import Geography
from sqlalchemy import ColumnElement, Select, cast, func, select
from sqlalchemy.orm import Session

from api.schemas import EventType

# Limiti di paginazione di `GET /events`.
DEFAULT_LIMIT = 100
MAX_LIMIT = 1000


def _filters(
    *,
    event_type: EventType | None,
    min_magnitude: float | None,
    start: datetime | None,
    end: datetime | None,
    min_lat: float | None,
    max_lat: float | None,
    min_lon: float | None,
    max_lon: float | None,
    near_lat: float | None,
    near_lon: float | None,
    radius_km: float | None,
) -> list[ColumnElement[bool]]:
    """Costruisce la lista di condizioni WHERE dai parametri di filtro."""
    conditions: list[ColumnElement[bool]] = []

    if event_type is not None:
        conditions.append(Event.event_type == event_type)
    if min_magnitude is not None:
        # I record senza magnitudo (vulcani) sono esclusi quando il filtro è attivo.
        conditions.append(Event.magnitude >= min_magnitude)
    if start is not None:
        conditions.append(Event.occurred_at >= start)
    if end is not None:
        conditions.append(Event.occurred_at <= end)

    # Bounding box: ogni lato è un limite indipendente e opzionale.
    if min_lat is not None:
        conditions.append(Event.lat >= min_lat)
    if max_lat is not None:
        conditions.append(Event.lat <= max_lat)
    if min_lon is not None:
        conditions.append(Event.lon >= min_lon)
    if max_lon is not None:
        conditions.append(Event.lon <= max_lon)

    # Vicinanza PostGIS: ST_DWithin su geography (metri) → usa l'indice GiST su geom.
    if near_lat is not None and near_lon is not None and radius_km is not None:
        point = cast(
            func.ST_SetSRID(func.ST_MakePoint(near_lon, near_lat), 4326),
            Geography(geometry_type="POINT", srid=4326),
        )
        conditions.append(func.ST_DWithin(Event.geom, point, radius_km * 1000.0))

    return conditions


def build_events_select(
    *,
    event_type: EventType | None = None,
    min_magnitude: float | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    min_lat: float | None = None,
    max_lat: float | None = None,
    min_lon: float | None = None,
    max_lon: float | None = None,
    near_lat: float | None = None,
    near_lon: float | None = None,
    radius_km: float | None = None,
    order: str = "desc",
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
) -> Select[tuple[Event]]:
    """`SELECT` paginato e ordinato per `occurred_at` (default DESC), `id` come tiebreaker."""
    conditions = _filters(
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
    )
    if order == "asc":
        ordering = (Event.occurred_at.asc(), Event.id.asc())
    else:
        ordering = (Event.occurred_at.desc(), Event.id.desc())

    return select(Event).where(*conditions).order_by(*ordering).limit(limit).offset(offset)


def list_events(
    session: Session, **kwargs
) -> tuple[list[Event], int]:
    """Esegue la query eventi: ritorna `(righe della pagina, totale che soddisfa i filtri)`.

    Il totale ignora `limit`/`offset` (serve all'envelope di paginazione).
    """
    # Estrai i parametri che non riguardano il conteggio.
    count_kwargs = {
        k: v for k, v in kwargs.items() if k not in ("order", "limit", "offset")
    }
    conditions = _filters(
        event_type=count_kwargs.get("event_type"),
        min_magnitude=count_kwargs.get("min_magnitude"),
        start=count_kwargs.get("start"),
        end=count_kwargs.get("end"),
        min_lat=count_kwargs.get("min_lat"),
        max_lat=count_kwargs.get("max_lat"),
        min_lon=count_kwargs.get("min_lon"),
        max_lon=count_kwargs.get("max_lon"),
        near_lat=count_kwargs.get("near_lat"),
        near_lon=count_kwargs.get("near_lon"),
        radius_km=count_kwargs.get("radius_km"),
    )
    total = session.scalar(select(func.count()).select_from(Event).where(*conditions)) or 0
    rows = list(session.scalars(build_events_select(**kwargs)).all())
    return rows, total


def compute_stats(session: Session) -> dict:
    """Aggregati per `GET /stats` (finestre rolling 24h/7g su `occurred_at`)."""
    now = session.scalar(select(func.now()))
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    eq = Event.event_type == "earthquake"
    volcano = Event.event_type == "volcano"

    events_24h = session.scalar(
        select(func.count()).select_from(Event).where(Event.occurred_at >= since_24h)
    )
    events_7d = session.scalar(
        select(func.count()).select_from(Event).where(Event.occurred_at >= since_7d)
    )
    earthquakes_24h = session.scalar(
        select(func.count()).select_from(Event).where(eq, Event.occurred_at >= since_24h)
    )
    max_magnitude_24h = session.scalar(
        select(func.max(Event.magnitude)).where(eq, Event.occurred_at >= since_24h)
    )
    # Vulcani "attivi": numero GVP distinto (meta->volcano_number) con un evento negli ultimi 7g.
    active_volcanoes_7d = session.scalar(
        select(func.count(func.distinct(Event.meta["volcano_number"].astext))).where(
            volcano, Event.occurred_at >= since_7d
        )
    )

    return {
        "generated_at": now,
        "events_24h": events_24h or 0,
        "events_7d": events_7d or 0,
        "earthquakes_24h": earthquakes_24h or 0,
        "max_magnitude_24h": max_magnitude_24h,
        "active_volcanoes_7d": active_volcanoes_7d or 0,
    }
