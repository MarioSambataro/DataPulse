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
