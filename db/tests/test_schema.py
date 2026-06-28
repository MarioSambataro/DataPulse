"""Test dello schema (statici, senza connessione al DB)."""

from db.models import EVENT_TYPES, SOURCES, Event


def test_events_table_name():
    assert Event.__tablename__ == "events"


def test_events_has_expected_columns():
    cols = set(Event.__table__.columns.keys())
    expected = {
        "id",
        "source",
        "event_type",
        "occurred_at",
        "lat",
        "lon",
        "geom",
        "depth_km",
        "magnitude",
        "severity",
        "title",
        "place",
        "meta",
        "ingested_at",
    }
    assert cols == expected


def test_primary_key_is_id():
    assert [c.name for c in Event.__table__.primary_key.columns] == ["id"]


def test_expected_indexes_present():
    names = {ix.name for ix in Event.__table__.indexes}
    assert {"ix_events_occurred_at", "ix_events_event_type", "ix_events_geom"} <= names


def test_enum_values():
    assert SOURCES == ("usgs", "gvp")
    assert EVENT_TYPES == ("earthquake", "volcano")
