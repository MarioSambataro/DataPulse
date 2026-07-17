"""Normalize USGS GeoJSON and GVP RSS into the unified `events` schema.

This pure pandas module performs no network or database access, enabling offline
fixture tests. Deterministic IDs support idempotency, source timestamps become
UTC datetimes, and the database trigger derives `geom` from coordinates.
"""

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import pandas as pd

# Columns written to `events`; the database trigger supplies geometry.
EVENT_COLUMNS = (
    "id",
    "source",
    "event_type",
    "occurred_at",
    "lat",
    "lon",
    "depth_km",
    "magnitude",
    "severity",
    "title",
    "place",
    "meta",
)

# USGS properties retained as source-specific JSON metadata.
_META_KEYS = ("code", "ids", "net", "magType", "status", "tsunami", "felt", "url", "type")


def severity_from_magnitude(magnitude: float | None) -> float | None:
    """Map magnitude linearly to rendering severity with `clamp(mag / 10, 0, 1)`.

    Unknown values remain null, while negative micro-earthquake magnitudes clamp
    to zero. The monotonic result drives marker size and color.
    """
    if magnitude is None:
        return None
    if isinstance(magnitude, float) and math.isnan(magnitude):
        return None
    return max(0.0, min(1.0, magnitude / 10.0))


def _coord(coords: Any, index: int) -> float | None:
    if isinstance(coords, (list, tuple)) and len(coords) > index and coords[index] is not None:
        return float(coords[index])
    return None


def normalize_geojson(geojson: dict) -> pd.DataFrame:
    """Convert a USGS GeoJSON FeatureCollection into an events DataFrame.

    Rows missing a deterministic code or valid coordinates are discarded. The
    caller compares source and result lengths to report dropped rows.
    """
    features = geojson.get("features", [])
    rows: list[dict[str, Any]] = []
    for feat in features:
        props = feat.get("properties") or {}
        coords = (feat.get("geometry") or {}).get("coordinates")

        code = props.get("code")
        lon = _coord(coords, 0)
        lat = _coord(coords, 1)
        if code is None or lon is None or lat is None:
            continue

        mag = props.get("mag")
        mag = float(mag) if mag is not None else None
        time_ms = props.get("time")
        occurred_at = (
            datetime.fromtimestamp(time_ms / 1000, tz=UTC)
            if time_ms is not None
            else None
        )
        title = props.get("title") or (f"M {mag} - {props.get('place')}" if mag is not None else "")
        meta = {k: props[k] for k in _META_KEYS if props.get(k) is not None}

        rows.append(
            {
                "id": f"usgs:{code}",
                "source": "usgs",
                "event_type": "earthquake",
                "occurred_at": occurred_at,
                "lat": lat,
                "lon": lon,
                "depth_km": _coord(coords, 2),
                "magnitude": mag,
                "severity": severity_from_magnitude(mag),
                "title": title,
                "place": props.get("place"),
                "meta": meta,
            }
        )

    df = pd.DataFrame(rows, columns=list(EVENT_COLUMNS))
    # USGS revisions may repeat a code within one window; keep the latest row.
    if not df.empty:
        df = df.drop_duplicates(subset="id", keep="last").reset_index(drop=True)
    return df


def to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert a DataFrame into native Python records suitable for SQLAlchemy."""
    records: list[dict[str, Any]] = []
    for row in df.to_dict(orient="records"):
        clean: dict[str, Any] = {}
        for key, value in row.items():
            if isinstance(value, float) and math.isnan(value):
                clean[key] = None
            elif isinstance(value, pd.Timestamp):
                clean[key] = value.to_pydatetime()
            elif value is pd.NaT:
                clean[key] = None
            else:
                clean[key] = value
        records.append(clean)
    return records


# ---------------------------------------------------------------------------
# GVP Weekly Volcanic Activity Report to unified `events`
# ---------------------------------------------------------------------------
#
# Each RSS item provides the volcano number, coordinates, categorized title, and
# publication date needed for one deterministic weekly record.
#
# Volcano records intentionally have no earthquake magnitude or depth.

_GEORSS_NS = {"georss": "http://www.georss.org/georss"}

# `<name> (<country>) - Report for <period> - <category>`.
_GVP_TITLE_RE = re.compile(
    r"^(?P<name>.*?) \((?P<country>.*?)\) - Report for (?P<period>.*?) - (?P<category>.*)$"
)
_VNUM_RE = re.compile(r"vn_(\d+)")
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Source fields retained as JSON metadata for details and tickers.
_GVP_META_KEYS = (
    "volcano_number",
    "volcano_name",
    "country",
    "category",
    "week_iso",
    "report_period",
    "link",
    "summary",
)


def severity_from_activity(category: str | None) -> float:
    """Derive a 0–1 severity from the weekly report activity category.

    Categories are more consistent than free-text alert levels. Eruptive activity
    maps to 0.8, unrest to 0.4, and unknown categories to 0.5; new activity adds
    0.1. Presence in the report always yields a non-null severity.
    """
    text = (category or "").lower()
    if "erupt" in text:
        base = 0.8
    elif "unrest" in text:
        base = 0.4
    else:
        base = 0.5
    if text.startswith("new"):
        base += 0.1
    return max(0.0, min(1.0, base))


def _strip_html(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = _HTML_TAG_RE.sub(" ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def _iso_week(dt: datetime) -> str:
    """Return the `YYYY-Www` ISO week for a UTC timestamp."""
    year, week, _ = dt.astimezone(UTC).isocalendar()
    return f"{year}-W{week:02d}"


def _georss_point(item: ET.Element) -> tuple[float | None, float | None]:
    node = item.find("georss:point", _GEORSS_NS)
    if node is None or not (node.text or "").strip():
        return None, None
    parts = node.text.split()
    if len(parts) != 2:
        return None, None
    try:
        lat, lon = float(parts[0]), float(parts[1])  # GeoRSS order: latitude, longitude
    except ValueError:
        return None, None
    return lat, lon


def normalize_weekly_report(xml_bytes: bytes) -> pd.DataFrame:
    """Convert raw GVP RSS XML into an events DataFrame.

    Items without a volcano number, date, or valid point are discarded. Weekly
    deterministic IDs follow `gvp:<number>:<week>`.
    """
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    items = channel.findall("item") if channel is not None else []

    rows: list[dict[str, Any]] = []
    for item in items:
        guid = item.findtext("guid") or ""
        vmatch = _VNUM_RE.search(guid)
        lat, lon = _georss_point(item)
        pub = item.findtext("pubDate")
        if vmatch is None or lat is None or lon is None or not pub:
            continue

        volcano_number = vmatch.group(1)
        occurred_at = parsedate_to_datetime(pub).astimezone(UTC)
        week_iso = _iso_week(occurred_at)

        raw_title = (item.findtext("title") or "").strip()
        tmatch = _GVP_TITLE_RE.match(raw_title)
        if tmatch:
            name = tmatch.group("name").strip()
            country = tmatch.group("country").strip()
            period = tmatch.group("period").strip()
            category = tmatch.group("category").strip()
            title = f"{name} — {category}"
        else:
            name, country, period, category = raw_title or None, None, None, None
            title = raw_title

        meta = {
            "volcano_number": volcano_number,
            "volcano_name": name,
            "country": country,
            "category": category,
            "week_iso": week_iso,
            "report_period": period,
            "link": item.findtext("link"),
            "summary": _strip_html(item.findtext("description")),
        }
        meta = {k: meta[k] for k in _GVP_META_KEYS if meta.get(k) is not None}

        rows.append(
            {
                "id": f"gvp:{volcano_number}:{week_iso}",
                "source": "gvp",
                "event_type": "volcano",
                "occurred_at": occurred_at,
                "lat": lat,
                "lon": lon,
                "depth_km": None,  # Volcanoes have no depth in the unified schema.
                "magnitude": None,  # Volcanoes have no earthquake magnitude.
                "severity": severity_from_activity(category),
                "title": title,
                "place": country,
                "meta": meta,
            }
        )

    df = pd.DataFrame(rows, columns=list(EVENT_COLUMNS))
    # Keep the latest duplicate for one volcano and ISO week.
    if not df.empty:
        df = df.drop_duplicates(subset="id", keep="last").reset_index(drop=True)
    return df
