"""Test end-to-end degli endpoint API contro Postgres+PostGIS reale.

Coprono: envelope/paginazione, filtri (tipo, magnitudo, tempo, bbox), vicinanza
PostGIS (`ST_DWithin`), validazione coerenza parametri, ordinamento, il trigger
`geom` (lat/lon → geometria) e la semantica di `/stats`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from db.models import Event
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def _event(**overrides) -> Event:
    """Costruisce un Event ORM con default sensati (geom la popola il trigger)."""
    base = {
        "id": "usgs:test",
        "source": "usgs",
        "event_type": "earthquake",
        "occurred_at": datetime.now(UTC) - timedelta(hours=1),
        "lat": 38.0,
        "lon": 15.0,
        "magnitude": 4.0,
        "severity": 0.4,
        "title": "test event",
        "place": None,
        "meta": {},
    }
    base.update(overrides)
    return Event(**base)


def _seed(session: Session, events: list[Event]) -> None:
    session.add_all(events)
    session.flush()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_events_empty_envelope(client):
    resp = client.get("/events")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"items": [], "total": 0, "limit": 100, "offset": 0}


def test_events_envelope_and_no_geom(client, db_session):
    _seed(db_session, [_event(id="usgs:1")])
    body = client.get("/events").json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["id"] == "usgs:1"
    assert item["lat"] == 38.0 and item["lon"] == 15.0
    # Contratto pubblico: mai la geometria interna.
    assert "geom" not in item


def test_trigger_populates_geom(client, db_session):
    """Inserendo solo lat/lon il trigger DB calcola geom (verifica via ST_AsText)."""
    _seed(db_session, [_event(id="usgs:geo", lat=10.0, lon=20.0)])
    wkt = db_session.scalar(
        select(func.ST_AsText(Event.geom)).where(Event.id == "usgs:geo")
    )
    assert wkt == "POINT(20 10)"


def test_filter_event_type(client, db_session):
    _seed(
        db_session,
        [
            _event(id="usgs:eq", event_type="earthquake"),
            _event(id="gvp:v", source="gvp", event_type="volcano", magnitude=None, lat=0, lon=0),
        ],
    )
    body = client.get("/events", params={"event_type": "volcano"}).json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == "gvp:v"


def test_filter_min_magnitude_excludes_volcanoes(client, db_session):
    _seed(
        db_session,
        [
            _event(id="usgs:small", magnitude=2.0),
            _event(id="usgs:big", magnitude=5.5),
            _event(id="gvp:v", source="gvp", event_type="volcano", magnitude=None, lat=1, lon=1),
        ],
    )
    body = client.get("/events", params={"min_magnitude": 3.0}).json()
    ids = {it["id"] for it in body["items"]}
    assert ids == {"usgs:big"}


def test_filter_time_window(client, db_session):
    now = datetime.now(UTC)
    _seed(
        db_session,
        [
            _event(id="usgs:old", occurred_at=now - timedelta(days=10)),
            _event(id="usgs:recent", occurred_at=now - timedelta(hours=2)),
        ],
    )
    start = (now - timedelta(days=1)).isoformat()
    body = client.get("/events", params={"start": start}).json()
    assert {it["id"] for it in body["items"]} == {"usgs:recent"}


def test_filter_bbox(client, db_session):
    _seed(
        db_session,
        [
            _event(id="usgs:in", lat=38.0, lon=15.0),
            _event(id="usgs:out", lat=10.0, lon=15.0),
        ],
    )
    params = {"min_lat": 30, "max_lat": 45, "min_lon": 10, "max_lon": 20}
    body = client.get("/events", params=params).json()
    assert {it["id"] for it in body["items"]} == {"usgs:in"}


def test_bbox_inverted_returns_422(client):
    resp = client.get("/events", params={"min_lat": 45, "max_lat": 30})
    assert resp.status_code == 422


def test_near_postgis(client, db_session):
    # Riferimento: Catania (37.5, 15.1). 'near' ~10km, 'far' ~oceano Pacifico.
    _seed(
        db_session,
        [
            _event(id="usgs:near", lat=37.55, lon=15.12),
            _event(id="usgs:far", lat=-20.0, lon=-150.0),
        ],
    )
    params = {"near_lat": 37.5, "near_lon": 15.1, "radius_km": 50}
    body = client.get("/events", params=params).json()
    assert {it["id"] for it in body["items"]} == {"usgs:near"}


def test_near_partial_params_returns_422(client):
    resp = client.get("/events", params={"near_lat": 37.5, "near_lon": 15.1})
    assert resp.status_code == 422


def test_ordering_and_pagination(client, db_session):
    now = datetime.now(UTC)
    _seed(
        db_session,
        [
            _event(id="usgs:a", occurred_at=now - timedelta(hours=3)),
            _event(id="usgs:b", occurred_at=now - timedelta(hours=2)),
            _event(id="usgs:c", occurred_at=now - timedelta(hours=1)),
        ],
    )
    # Default DESC: il più recente per primo.
    desc = client.get("/events").json()
    assert [it["id"] for it in desc["items"]] == ["usgs:c", "usgs:b", "usgs:a"]
    # ASC.
    asc = client.get("/events", params={"order": "asc"}).json()
    assert [it["id"] for it in asc["items"]] == ["usgs:a", "usgs:b", "usgs:c"]
    # Paginazione: total ignora limit/offset.
    page = client.get("/events", params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3
    assert [it["id"] for it in page["items"]] == ["usgs:b"]


def test_limit_over_max_returns_422(client):
    resp = client.get("/events", params={"limit": 5000})
    assert resp.status_code == 422


def test_stats_semantics(client, db_session):
    now = datetime.now(UTC)
    _seed(
        db_session,
        [
            # Terremoti: 2 nelle 24h (mag 3 e 6), 1 a 3 giorni (dentro 7g, fuori 24h).
            _event(id="usgs:eq1", occurred_at=now - timedelta(hours=1), magnitude=3.0),
            _event(id="usgs:eq2", occurred_at=now - timedelta(hours=5), magnitude=6.0),
            _event(id="usgs:eq3", occurred_at=now - timedelta(days=3), magnitude=2.0),
            # Vulcani: 2 vulcani distinti negli ultimi 7g, 1 oltre i 7g.
            _event(
                id="gvp:1", source="gvp", event_type="volcano", magnitude=None,
                lat=0, lon=0, occurred_at=now - timedelta(days=2), meta={"volcano_number": "111"},
            ),
            _event(
                id="gvp:2", source="gvp", event_type="volcano", magnitude=None,
                lat=1, lon=1, occurred_at=now - timedelta(days=4), meta={"volcano_number": "222"},
            ),
            _event(
                id="gvp:3", source="gvp", event_type="volcano", magnitude=None,
                lat=2, lon=2, occurred_at=now - timedelta(days=20), meta={"volcano_number": "333"},
            ),
        ],
    )
    stats = client.get("/stats").json()
    assert stats["events_24h"] == 2  # eq1, eq2
    assert stats["events_7d"] == 5  # eq1, eq2, eq3, gvp:1, gvp:2
    assert stats["earthquakes_24h"] == 2
    assert stats["max_magnitude_24h"] == 6.0
    assert stats["active_volcanoes_7d"] == 2  # num 111 e 222


@pytest.mark.parametrize("path", ["/events", "/stats"])
def test_endpoints_ok(client, path):
    assert client.get(path).status_code == 200
