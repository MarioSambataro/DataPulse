"""Tests for status, metrics, HTTP caching, and rate limiting."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from db.models import Event


def _event(**overrides) -> Event:
    base = {
        "id": "usgs:obs",
        "source": "usgs",
        "event_type": "earthquake",
        "occurred_at": datetime.now(UTC) - timedelta(hours=1),
        "lat": 38.0,
        "lon": 15.0,
        "magnitude": 4.0,
        "severity": 0.4,
        "title": "obs event",
        "place": None,
        "meta": {},
    }
    base.update(overrides)
    return Event(**base)


# ---------------------------------------------------------------------------
# /status
# ---------------------------------------------------------------------------


def test_status_empty_db(client):
    body = client.get("/status").json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["events_total"] == 0
    assert body["last_ingested_at"] is None
    assert body["uptime_s"] >= 0


def test_status_reports_freshness(client, db_session):
    db_session.add(_event())
    db_session.flush()
    body = client.get("/status").json()
    assert body["events_total"] == 1
    assert body["last_ingested_at"] is not None
    # Server-default ingestion time should produce a small non-negative age.
    assert body["last_event_age_s"] is not None
    assert 0 <= body["last_event_age_s"] < 3600


# ---------------------------------------------------------------------------
# /metrics
# ---------------------------------------------------------------------------


def test_metrics_exposition(client):
    client.get("/health")  # Register at least one request.
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert "datapulse_http_requests_total" in resp.text


# ---------------------------------------------------------------------------
# Caching HTTP: Cache-Control + ETag/304 su /events e /stats
# ---------------------------------------------------------------------------


def test_events_etag_roundtrip(client):
    first = client.get("/events")
    assert first.status_code == 200
    etag = first.headers.get("etag")
    assert etag
    assert "max-age" in first.headers.get("cache-control", "")

    second = client.get("/events", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""


def test_etag_changes_with_data(client, db_session):
    empty_etag = client.get("/stats").headers.get("etag")
    db_session.add(_event(id="usgs:etag"))
    db_session.flush()
    full_etag = client.get("/stats").headers.get("etag")
    assert empty_etag and full_etag and empty_etag != full_etag


def test_health_not_cached(client):
    resp = client.get("/health")
    assert "etag" not in resp.headers


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


def test_rate_limit_kicks_in(client, monkeypatch):
    from api.middleware import reset_rate_limiter

    reset_rate_limiter()  # Avoid carrying hits across the 60-second window.
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "3")
    # Unmatched non-exempt paths still count toward the window.
    for _ in range(3):
        assert client.get("/nope").status_code == 404
    resp = client.get("/nope")
    assert resp.status_code == 429
    assert resp.headers.get("retry-after")
    reset_rate_limiter()  # Keep subsequent tests isolated.


def test_rate_limit_exempts_health(client, monkeypatch):
    from api.middleware import reset_rate_limiter

    reset_rate_limiter()
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    for _ in range(5):
        assert client.get("/health").status_code == 200
    reset_rate_limiter()
