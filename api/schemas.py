"""Modelli Pydantic v2 condivisi dell'API DataPulse.

`Event` è il contratto pubblico di un evento geo-tettonico. Espone `lat`/`lon`
(non la geometria PostGIS interna `geom`): il frontend lavora con le coordinate
grezze. `model_config.from_attributes=True` permette di costruirlo direttamente da
un'istanza ORM (`db.models.Event`), che ha gli stessi attributi.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["usgs", "gvp"]
EventType = Literal["earthquake", "volcano"]


class Event(BaseModel):
    """Evento unificato (terremoto o vulcano) esposto dall'API."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Chiave deterministica, es. 'usgs:<code>'.")
    source: Source
    event_type: EventType
    occurred_at: datetime = Field(description="Istante UTC dell'evento.")

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)

    depth_km: float | None = Field(default=None, description="Profondità (solo terremoti).")
    magnitude: float | None = Field(default=None, description="Magnitudo (solo terremoti).")
    severity: float | None = Field(
        default=None, ge=0, le=1, description="Metrica normalizzata 0–1 per il rendering."
    )

    title: str
    place: str | None = None

    meta: dict = Field(default_factory=dict, description="Campi specifici della sorgente.")
    ingested_at: datetime | None = None


class EventPage(BaseModel):
    """Risposta paginata di `GET /events` (envelope con metadati di paginazione).

    Scelta SEZIONE 9: envelope invece di lista nuda, così il frontend conosce il
    `total` (numero di eventi che soddisfano i filtri, ignorando limit/offset) per
    rendere paginazione/contatori senza una seconda chiamata.
    """

    items: list[Event]
    total: int = Field(ge=0, description="Eventi totali che soddisfano i filtri (no limit/offset).")
    limit: int = Field(ge=1, description="Dimensione pagina richiesta.")
    offset: int = Field(ge=0, description="Offset richiesto.")


class Stats(BaseModel):
    """Aggregati di `GET /stats`.

    Finestre **rolling** relative a `generated_at` (istante UTC della risposta),
    calcolate su `occurred_at`:
      - 24h = `[generated_at - 24h, generated_at]`
      - 7g  = `[generated_at - 7 giorni, generated_at]`
    """

    generated_at: datetime = Field(description="Istante UTC di calcolo (origine delle finestre).")
    events_24h: int = Field(ge=0, description="Eventi (qualsiasi tipo) nelle ultime 24h.")
    events_7d: int = Field(ge=0, description="Eventi (qualsiasi tipo) negli ultimi 7 giorni.")
    earthquakes_24h: int = Field(ge=0, description="Terremoti nelle ultime 24h.")
    max_magnitude_24h: float | None = Field(
        default=None, description="Magnitudo massima tra i terremoti delle ultime 24h (null se 0)."
    )
    active_volcanoes_7d: int = Field(
        ge=0, description="Vulcani distinti (per numero GVP) con attività negli ultimi 7 giorni."
    )
