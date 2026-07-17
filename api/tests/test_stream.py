"""Tests for the SSE feed and its ingestion-watermark query."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from db.models import Event

from api.queries import events_since


def _event(id_: str, ingested_at=None) -> Event:
    return Event(
        id=id_,
        source="usgs",
        event_type="earthquake",
        occurred_at=datetime.now(UTC) - timedelta(hours=1),
        lat=38.0,
        lon=15.0,
        magnitude=4.0,
        severity=0.4,
        title="stream event",
        place=None,
        meta={},
        **({"ingested_at": ingested_at} if ingested_at else {}),
    )


def test_events_since_watermark(db_session):
    now = datetime.now(UTC)
    db_session.add_all(
        [
            _event("usgs:old", ingested_at=now - timedelta(minutes=10)),
            _event("usgs:new1", ingested_at=now - timedelta(seconds=30)),
            _event("usgs:new2", ingested_at=now - timedelta(seconds=10)),
        ]
    )
    db_session.flush()

    rows = events_since(db_session, watermark=now - timedelta(minutes=5))
    assert [r.id for r in rows] == ["usgs:new1", "usgs:new2"]  # Ascending ingestion time.

    # Advancing to the final watermark prevents duplicates on the next poll.
    rows2 = events_since(db_session, watermark=rows[-1].ingested_at)
    assert rows2 == []


def test_stream_protocol_keepalive(client, monkeypatch):
    # A short maximum lifetime lets the test consume the complete finite stream.
    monkeypatch.setenv("EVENTS_STREAM_POLL_SECONDS", "0.05")
    monkeypatch.setenv("EVENTS_STREAM_MAX_LIFETIME_S", "0.3")
    # Use Z because a plus sign in a query string may decode as a space.
    future = (datetime.now(UTC) + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")

    with client.stream("GET", f"/events/stream?since={future}") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        lines = [line for line in resp.iter_lines() if line]

    assert lines[0] == "retry: 5000"
    # A future watermark produces only keepalive or diagnostic comments.
    assert all(line.startswith(":") for line in lines[1:])
    assert len(lines) >= 2  # At least one poll occurs before closure.
