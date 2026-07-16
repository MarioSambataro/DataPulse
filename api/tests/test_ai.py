"""Test degli endpoint /ai/* con il client DeepSeek sostituito (niente rete).

`api.ai._chat` è l'unico punto di contatto con l'esterno: nei test lo si
rimpiazza con una coroutine finta, così si copre tutta la logica applicativa
(parsing/validazione filtri, coerenza vicinanza, cache del briefing, errori)
in modo deterministico.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from db.models import Event

import api.ai as ai_module


def _fake_chat(payload: str):
    """Coroutine factory: risponde sempre `payload` ignorando i messaggi."""

    async def fake(messages, *, json_mode: bool = False) -> str:
        return payload

    return fake


@pytest.fixture(autouse=True)
def _fresh_briefing_cache(monkeypatch):
    monkeypatch.setattr(ai_module, "_briefing_cache", None)


# ---------------------------------------------------------------------------
# POST /ai/query
# ---------------------------------------------------------------------------


def test_ai_query_translates_filters(client, monkeypatch):
    monkeypatch.setattr(
        ai_module,
        "_chat",
        _fake_chat(
            json.dumps(
                {
                    "answer": "Terremoti M≥5 vicino al Giappone",
                    "filters": {
                        "event_type": "earthquake",
                        "min_magnitude": 5,
                        "near_lat": 36.0,
                        "near_lon": 138.0,
                        "radius_km": 1500,
                        "campo_inventato": "ignorami",
                    },
                }
            )
        ),
    )
    resp = client.post("/ai/query", json={"question": "terremoti forti vicino al giappone"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"].startswith("Terremoti")
    assert body["filters"]["event_type"] == "earthquake"
    assert body["filters"]["min_magnitude"] == 5
    assert body["filters"]["radius_km"] == 1500
    assert "campo_inventato" not in body["filters"]


def test_ai_query_drops_incomplete_near(client, monkeypatch):
    """Vicinanza parziale (manca radius_km) → azzerata, non propagata a metà."""
    monkeypatch.setattr(
        ai_module,
        "_chat",
        _fake_chat(json.dumps({"answer": "x", "filters": {"near_lat": 10, "near_lon": 20}})),
    )
    body = client.post("/ai/query", json={"question": "eventi vicino a boh"}).json()
    assert body["filters"]["near_lat"] is None
    assert body["filters"]["near_lon"] is None
    assert body["filters"]["radius_km"] is None


def test_ai_query_invalid_json_is_502(client, monkeypatch):
    monkeypatch.setattr(ai_module, "_chat", _fake_chat("non sono json"))
    resp = client.post("/ai/query", json={"question": "terremoti oggi"})
    assert resp.status_code == 502


def test_ai_query_out_of_bounds_filters_502(client, monkeypatch):
    monkeypatch.setattr(
        ai_module,
        "_chat",
        _fake_chat(json.dumps({"answer": "x", "filters": {"near_lat": 999}})),
    )
    resp = client.post("/ai/query", json={"question": "eventi"})
    assert resp.status_code == 502


def test_ai_requires_api_key(client, monkeypatch):
    """Senza DEEPSEEK_API_KEY (e senza patch di _chat) → 503 esplicita."""
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    resp = client.post("/ai/query", json={"question": "terremoti oggi"})
    assert resp.status_code == 503
    assert "DEEPSEEK_API_KEY" in resp.json()["detail"]


def test_ai_query_validates_question_length(client):
    resp = client.post("/ai/query", json={"question": "ab"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /ai/briefing
# ---------------------------------------------------------------------------


def _quake(id_: str, mag: float) -> Event:
    return Event(
        id=id_,
        source="usgs",
        event_type="earthquake",
        occurred_at=datetime.now(UTC) - timedelta(hours=2),
        lat=38.0,
        lon=15.0,
        magnitude=mag,
        severity=0.5,
        title=f"M{mag} test",
        place="Test Place",
        meta={},
    )


def test_briefing_generates_and_caches(client, db_session, monkeypatch):
    db_session.add_all([_quake("usgs:b1", 5.8), _quake("usgs:b2", 4.2)])
    db_session.flush()
    monkeypatch.setattr(ai_module, "_chat", _fake_chat("Situazione tranquilla nel Mediterraneo."))

    first = client.get("/ai/briefing")
    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert "tranquilla" in first.json()["briefing"]

    second = client.get("/ai/briefing")
    assert second.json()["cached"] is True
    assert second.json()["briefing"] == first.json()["briefing"]
