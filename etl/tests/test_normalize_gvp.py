"""Test offline di parsing/normalizzazione GVP (niente rete, niente DB).

Lavorano sul fixture `fixtures/gvp_weekly_sample.xml` (5 item: 3 validi + uno
senza georss:point e uno senza numero vulcano nel guid, entrambi da scartare).
Il fixture è codificato in **ISO-8859-1** come il feed reale, così si verifica
anche il decoding corretto degli accenti.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from etl import normalize

FIXTURE = Path(__file__).parent / "fixtures" / "gvp_weekly_sample.xml"


@pytest.fixture
def xml_bytes() -> bytes:
    return FIXTURE.read_bytes()


@pytest.fixture
def df(xml_bytes):
    return normalize.normalize_weekly_report(xml_bytes)


@pytest.fixture
def by_id(df):
    return {r["id"]: r for r in normalize.to_records(df)}


def test_drops_items_without_number_or_point(df):
    # 5 item nel fixture, 2 da scartare -> 3 righe normalizzate.
    assert len(df) == 3
    assert all(i.startswith("gvp:") for i in df["id"])


def test_id_is_deterministic_per_week(by_id):
    # id = "gvp:<volcano_number>:<week_iso>"; pubDate 11 Jun 2026 -> ISO week 24.
    assert "gvp:257030:2026-W24" in by_id
    assert "gvp:357063:2026-W24" in by_id
    assert "gvp:282080:2026-W24" in by_id


def test_columns_match_schema(df):
    assert list(df.columns) == list(normalize.EVENT_COLUMNS)
    assert "geom" not in df.columns  # geom la popola il trigger DB


def test_source_and_type_constant(df):
    assert set(df["source"]) == {"gvp"}
    assert set(df["event_type"]) == {"volcano"}


def test_no_magnitude_or_depth(by_id):
    for rec in by_id.values():
        assert rec["magnitude"] is None
        assert rec["depth_km"] is None


def test_coordinates_lat_lon_order(by_id):
    # georss:point = "lat lon" -> Ambae -15.3890 167.8350
    rec = by_id["gvp:257030:2026-W24"]
    assert rec["lat"] == pytest.approx(-15.3890)
    assert rec["lon"] == pytest.approx(167.8350)


def test_occurred_at_is_utc(by_id):
    # pubDate "Thu, 11 Jun 2026 03:42:26 -0400" -> 07:42:26 UTC
    rec = by_id["gvp:257030:2026-W24"]
    assert rec["occurred_at"] == datetime(2026, 6, 11, 7, 42, 26, tzinfo=UTC)


def test_severity_from_activity_mapping():
    # eruzione 0.8, unrest 0.4, "New" +0.1, ignoto 0.5; clamp [0,1].
    assert normalize.severity_from_activity("New Eruptive Activity") == pytest.approx(0.9)
    assert normalize.severity_from_activity("Continuing Eruptive Activity") == pytest.approx(0.8)
    assert normalize.severity_from_activity("New Unrest") == pytest.approx(0.5)
    assert normalize.severity_from_activity("Continuing Unrest") == pytest.approx(0.4)
    assert normalize.severity_from_activity("Ongoing Activity") == pytest.approx(0.5)
    assert normalize.severity_from_activity(None) == pytest.approx(0.5)


def test_severity_applied_to_rows(by_id):
    assert by_id["gvp:257030:2026-W24"]["severity"] == pytest.approx(0.9)  # New Eruptive
    assert by_id["gvp:357063:2026-W24"]["severity"] == pytest.approx(0.5)  # New Unrest
    assert by_id["gvp:282080:2026-W24"]["severity"] == pytest.approx(0.8)  # Continuing Eruptive
    # i vulcani hanno sempre una severity (mai null)
    assert all(r["severity"] is not None for r in by_id.values())


def test_title_and_place_parsed(by_id):
    rec = by_id["gvp:257030:2026-W24"]
    assert rec["title"] == "Ambae — New Eruptive Activity"
    assert rec["place"] == "Vanuatu"


def test_meta_fields_and_iso8859_decoding(by_id):
    rec = by_id["gvp:357063:2026-W24"]
    meta = rec["meta"]
    assert meta["volcano_number"] == "357063"
    assert meta["volcano_name"] == "Nevado de Longaví"  # accento decodificato da ISO-8859-1
    assert meta["country"] == "Chile"
    assert meta["category"] == "New Unrest"
    assert meta["week_iso"] == "2026-W24"
    assert meta["report_period"] == "4 June-10 June 2026"
    assert "Geología" in meta["summary"]  # HTML strip + accenti
    assert "<p>" not in meta["summary"]


def test_to_records_clean_types(by_id):
    for rec in by_id.values():
        assert set(rec.keys()) == set(normalize.EVENT_COLUMNS)
        assert isinstance(rec["occurred_at"], datetime)


def test_duplicate_volcano_same_week_keeps_last():
    # Stesso volcano_number nella stessa settimana -> una sola riga (l'ultima vince).
    xml = b"""<?xml version="1.0" encoding="ISO-8859-1"?>
<rss version="2.0" xmlns:georss="http://www.georss.org/georss"><channel>
<item><title>Dup (X) - Report for 4 June-10 June 2026 - New Unrest</title>
<guid>x#vn_111</guid><pubDate>Thu, 11 Jun 2026 03:42:26 -0400</pubDate>
<georss:point>1.0 2.0</georss:point></item>
<item><title>Dup (X) - Report for 4 June-10 June 2026 - New Eruptive Activity</title>
<guid>x#vn_111</guid><pubDate>Thu, 11 Jun 2026 03:42:26 -0400</pubDate>
<georss:point>3.0 4.0</georss:point></item>
</channel></rss>"""
    df = normalize.normalize_weekly_report(xml)
    assert len(df) == 1
    row = df.iloc[0]
    assert row["lat"] == pytest.approx(3.0)
    assert row["severity"] == pytest.approx(0.9)  # l'ultima (New Eruptive)
