"""Test del modello Pydantic `Event` condiviso."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from api.schemas import Event


def _valid_payload() -> dict:
    return {
        "id": "usgs:abc123",
        "source": "usgs",
        "event_type": "earthquake",
        "occurred_at": datetime(2026, 6, 28, 12, 0, tzinfo=UTC),
        "lat": 38.1,
        "lon": 15.6,
        "magnitude": 4.2,
        "severity": 0.42,
        "title": "M 4.2 - Sicily, Italy",
    }


def test_event_minimal_valid():
    ev = Event.model_validate(_valid_payload())
    assert ev.source == "usgs"
    assert ev.depth_km is None
    assert ev.meta == {}


def test_event_does_not_expose_geom():
    assert "geom" not in Event.model_fields


def test_event_rejects_bad_source():
    payload = _valid_payload() | {"source": "nope"}
    with pytest.raises(ValidationError):
        Event.model_validate(payload)


def test_event_severity_range():
    payload = _valid_payload() | {"severity": 1.5}
    with pytest.raises(ValidationError):
        Event.model_validate(payload)


def test_event_from_attributes():
    class _Row:
        pass

    row = _Row()
    for k, v in _valid_payload().items():
        setattr(row, k, v)
    row.ingested_at = datetime(2026, 6, 28, 12, 5, tzinfo=UTC)
    ev = Event.model_validate(row)
    assert ev.id == "usgs:abc123"
