"""Test del feed SSE `/events/stream` e della query `events_since`.

La query (watermark su `ingested_at`) si testa direttamente sulla sessione
transazionale. Per l'endpoint si apre lo stream con `since` nel futuro remoto
(nessun evento possibile) e si verifica il protocollo: `retry:` iniziale +
keepalive; poi si chiude — TestClient supporta lo streaming con `.stream()`.
"""

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
    assert [r.id for r in rows] == ["usgs:new1", "usgs:new2"]  # ASC per ingested_at

    # Watermark avanzato all'ultimo elemento → nessun duplicato al giro dopo.
    rows2 = events_since(db_session, watermark=rows[-1].ingested_at)
    assert rows2 == []


def test_stream_protocol_keepalive(client, monkeypatch):
    # Vita massima brevissima: il generatore termina da solo (in produzione
    # l'EventSource si riconnette), così lo stream si può leggere fino in fondo
    # senza che il test resti appeso a una risposta infinita.
    monkeypatch.setenv("EVENTS_STREAM_POLL_SECONDS", "0.05")
    monkeypatch.setenv("EVENTS_STREAM_MAX_LIFETIME_S", "0.3")
    # 'Z' e non '+00:00': il '+' in query string verrebbe decodificato come spazio.
    future = (datetime.now(UTC) + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")

    with client.stream("GET", f"/events/stream?since={future}") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        lines = [line for line in resp.iter_lines() if line]

    assert lines[0] == "retry: 5000"
    # Con since nel futuro: solo keepalive/diagnostica (commenti), mai `event:`.
    assert all(line.startswith(":") for line in lines[1:])
    assert len(lines) >= 2  # almeno un giro di polling prima della chiusura
