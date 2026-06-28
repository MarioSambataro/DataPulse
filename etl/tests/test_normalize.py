"""Test offline di parsing/normalizzazione USGS (niente rete, niente DB).

Lavorano sul fixture `fixtures/usgs_sample.geojson` (5 feature, di cui una senza
`code` da scartare).
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from pathlib import Path

import pytest

from etl import normalize

FIXTURE = Path(__file__).parent / "fixtures" / "usgs_sample.geojson"


@pytest.fixture
def geojson() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def df(geojson):
    return normalize.normalize_geojson(geojson)


def test_drops_feature_without_code(geojson, df):
    # 5 feature nel fixture, 1 senza `code` -> 4 righe normalizzate.
    assert len(geojson["features"]) == 5
    assert len(df) == 4
    assert "usgs:" not in df["id"].tolist()  # nessun id malformato
    assert all(i.startswith("usgs:") for i in df["id"])


def test_id_is_deterministic(df):
    assert "usgs:7000abcd" in df["id"].tolist()
    assert "usgs:39812345" in df["id"].tolist()


def test_columns_match_schema(df):
    assert list(df.columns) == list(normalize.EVENT_COLUMNS)
    assert "geom" not in df.columns  # geom la popola il trigger DB


def test_source_and_type_constant(df):
    assert set(df["source"]) == {"usgs"}
    assert set(df["event_type"]) == {"earthquake"}


def test_coordinates_order_lon_lat_depth(df):
    row = df[df["id"] == "usgs:7000abcd"].iloc[0]
    # coordinates = [-178.234, -23.456, 567.8] -> lon, lat, depth_km
    assert row["lon"] == pytest.approx(-178.234)
    assert row["lat"] == pytest.approx(-23.456)
    assert row["depth_km"] == pytest.approx(567.8)


def test_time_ms_to_utc(df):
    row = df[df["id"] == "usgs:7000abcd"].iloc[0]
    expected = datetime(2024, 6, 28, 10, 40, 0, tzinfo=UTC)
    assert row["occurred_at"] == expected


def test_severity_linear_clamp(df):
    by_id = {r["id"]: r for r in normalize.to_records(df)}
    # mag 5.8 -> 0.58
    assert by_id["usgs:7000abcd"]["severity"] == pytest.approx(0.58)
    # mag 1.24 -> 0.124
    assert by_id["usgs:39812345"]["severity"] == pytest.approx(0.124)
    # mag null -> severity None
    assert by_id["usgs:73matt"]["severity"] is None
    assert by_id["usgs:73matt"]["magnitude"] is None
    # mag negativa -> clamp a 0
    assert by_id["usgs:0212neg"]["severity"] == 0.0


def test_severity_formula_units():
    assert normalize.severity_from_magnitude(None) is None
    assert normalize.severity_from_magnitude(float("nan")) is None
    assert normalize.severity_from_magnitude(-2.0) == 0.0
    assert normalize.severity_from_magnitude(5.0) == pytest.approx(0.5)
    assert normalize.severity_from_magnitude(12.0) == 1.0  # clamp al tetto


def test_meta_subset_preserved(df):
    row = df[df["id"] == "usgs:7000abcd"].iloc[0]
    meta = row["meta"]
    assert meta["net"] == "us"
    assert meta["magType"] == "mww"
    assert meta["status"] == "reviewed"
    assert "place" not in meta  # `place` è colonna a sé, non in meta


def test_to_records_clean_types(df):
    records = normalize.to_records(df)
    assert len(records) == 4
    for rec in records:
        assert set(rec.keys()) == set(normalize.EVENT_COLUMNS)
        assert isinstance(rec["occurred_at"], datetime)
        # niente NaN residui (devono essere None)
        for value in rec.values():
            assert not (isinstance(value, float) and math.isnan(value))


def test_duplicate_code_keeps_last():
    # Due feature con lo stesso code -> una sola riga (l'ultima vince).
    geojson = {
        "features": [
            {
                "properties": {"code": "dup", "mag": 1.0, "time": 1719571200000, "place": "a"},
                "geometry": {"coordinates": [1.0, 2.0, 3.0]},
            },
            {
                "properties": {"code": "dup", "mag": 9.9, "time": 1719571200000, "place": "b"},
                "geometry": {"coordinates": [4.0, 5.0, 6.0]},
            },
        ]
    }
    df = normalize.normalize_geojson(geojson)
    assert len(df) == 1
    assert df.iloc[0]["magnitude"] == pytest.approx(9.9)
    assert df.iloc[0]["place"] == "b"
