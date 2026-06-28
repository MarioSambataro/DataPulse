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
from datetime import UTC, datetime
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
