"""Normalizzazione GeoJSON USGS -> schema unificato `events` (con Pandas).

Trasforma un `FeatureCollection` della USGS Earthquake API in record pronti per
l'upsert nella tabella `events`. È un modulo *puro* (solo pandas/numpy): nessuna
rete, nessun DB, così i test girano offline sul fixture.

Punti chiave:
- `id = "usgs:" + properties.code` -> chiave deterministica per l'idempotenza.
- `geometry.coordinates = [lon, lat, depth_km]` (ordine GeoJSON: X=lon, Y=lat).
- `properties.time` è epoch in **millisecondi** -> convertito in UTC.
- `geom` NON viene mai prodotta qui: la calcola il trigger DB da `lat`/`lon`.
"""

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import pandas as pd

# Colonne scritte nella tabella `events` (geom esclusa: la popola il trigger DB).
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

# Sottoinsieme di `properties` USGS conservato in `meta` (jsonb) per riferimento.
_META_KEYS = ("code", "ids", "net", "magType", "status", "tsunami", "felt", "url", "type")


def severity_from_magnitude(magnitude: float | None) -> float | None:
    """Severity normalizzata 0..1 per il rendering: `clamp(magnitude / 10, 0, 1)`.

    Scelta (SEZIONE 3): mappatura **lineare** della magnitudo Richter su [0,1],
    con 10 come tetto pratico (i terremoti registrati restano sotto). Semplice,
    monotòna e leggibile dal frontend (dimensione/colore dell'epicentro). Le
    magnitudo negative (micro-sismi) vengono portate a 0; `None`/NaN restano `None`
    (non note), coerente col vincolo CHECK `severity IN [0,1] OR NULL`.
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
    """Da `FeatureCollection` GeoJSON a DataFrame con le colonne di `events`.

    Le feature senza `code` o senza coordinate lat/lon valide vengono scartate
    (non si può costruire un `id` o un punto): è responsabilità del chiamante
    loggare quante righe sono state perse confrontando le lunghezze.
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
    # USGS può ripetere lo stesso `code` nella stessa finestra (revisioni): tieni
    # l'ultima occorrenza così l'upsert non riceve due righe con lo stesso id.
    if not df.empty:
        df = df.drop_duplicates(subset="id", keep="last").reset_index(drop=True)
    return df


def to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Converte il DataFrame in record Python puliti per l'upsert SQLAlchemy.

    Normalizza i tipi numpy/pandas (NaN/NaT -> None, Timestamp -> datetime) così
    psycopg riceve solo tipi nativi.
    """
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
# GVP — Weekly Volcanic Activity Report (RSS) -> schema unificato `events`
# ---------------------------------------------------------------------------
#
# Ogni <item> del feed RSS porta tutto il necessario:
# - <guid> `...#vn_<number>`  -> numero vulcano (chiave idempotenza)
# - <georss:point> "lat lon"  -> coordinate (ordine GeoRSS: Y=lat, X=lon!)
# - <title> "<nome> (<paese>) - Report for <periodo> - <categoria attività>"
# - <pubDate> RFC822          -> istante UTC del report + settimana ISO
#
# A differenza dei terremoti i vulcani NON hanno magnitudo/profondità
# (event_type=volcano, source=gvp, magnitude=null, depth_km=null).

_GEORSS_NS = {"georss": "http://www.georss.org/georss"}

# `<nome> (<paese>) - Report for <periodo> - <categoria>`.
_GVP_TITLE_RE = re.compile(
    r"^(?P<name>.*?) \((?P<country>.*?)\) - Report for (?P<period>.*?) - (?P<category>.*)$"
)
_VNUM_RE = re.compile(r"vn_(\d+)")
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Sottoinsieme `meta` (jsonb) conservato per riferimento (tooltip/ticker futuri).
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
    """Severity 0..1 derivata dalla **categoria di attività** del weekly report.

    Scelta (SEZIONE 4): la categoria nel titolo (es. "New Eruptive Activity",
    "Continuing Eruptive Activity", "New Unrest") è l'unico campo *sempre presente
    e uniforme*; l'"Alert Level" nel testo libero della descrizione è invece
    incoerente (scale 0-5 numeriche, scale-colore con numero di colori variabile)
    e quindi non affidabile come segnale strutturato.

    Mappatura componibile (intensità + novità), così è robusta anche a varianti
    non viste ("Ongoing Activity", ecc.):
    - base intensità: eruzione -> 0.8, unrest -> 0.4, altro/ignoto -> 0.5
    - bonus novità:  "New ..." -> +0.1 (l'insorgenza è più notiziabile)
    - clamp finale in [0,1].

    Esiti: New Eruptive 0.9 · Continuing Eruptive 0.8 · New Unrest 0.5 ·
    Continuing Unrest 0.4. La severity dei vulcani non è mai null (la presenza nel
    report implica attività rilevante).
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
    """`YYYY-Www` (settimana ISO) dell'istante UTC dato."""
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
        lat, lon = float(parts[0]), float(parts[1])  # GeoRSS: "lat lon"
    except ValueError:
        return None, None
    return lat, lon


def normalize_weekly_report(xml_bytes: bytes) -> pd.DataFrame:
    """Da feed RSS GVP (bytes XML) a DataFrame con le colonne di `events`.

    Gli item senza numero vulcano o senza coordinate valide vengono scartati (non
    si può costruire un `id` o un punto): il chiamante logga le righe perse
    confrontando le lunghezze. Idempotenza per settimana: `id = gvp:<num>:<week>`.
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
                "depth_km": None,  # i vulcani non hanno profondità nello schema
                "magnitude": None,  # né magnitudo
                "severity": severity_from_activity(category),
                "title": title,
                "place": country,
                "meta": meta,
            }
        )

    df = pd.DataFrame(rows, columns=list(EVENT_COLUMNS))
    # Stesso vulcano due volte nella stessa settimana -> tieni l'ultima occorrenza
    # così l'upsert non riceve due righe con lo stesso id.
    if not df.empty:
        df = df.drop_duplicates(subset="id", keep="last").reset_index(drop=True)
    return df
