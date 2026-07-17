"""Optional DeepSeek endpoints for natural-language filters and briefings.

The model never accesses the database. `POST /ai/query` returns validated filter
parameters that the normal typed query path executes. `GET /ai/briefing` receives
only computed statistics and top events, then caches its Italian SITREP for 15
minutes. Configuration uses `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, and
`DEEPSEEK_BASE_URL`.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated

import httpx
from db.models import Event
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.config import deepseek_api_key, deepseek_base_url, deepseek_model
from api.db import get_session
from api.queries import compute_stats

router = APIRouter(prefix="/ai", tags=["ai"])

REQUEST_TIMEOUT_SECONDS = 30.0
BRIEFING_TTL_SECONDS = 15 * 60


# ---------------------------------------------------------------------------
# OpenAI-compatible DeepSeek client
# ---------------------------------------------------------------------------


async def _chat(messages: list[dict], *, json_mode: bool = False) -> str:
    """Call `/chat/completions` and return the assistant text.

    The isolated module function can be replaced in tests without network access
    or an API key.
    """
    api_key = deepseek_api_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured; set DEEPSEEK_API_KEY on the backend.",
        )

    body: dict = {
        "model": deepseek_model(),
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 500,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{deepseek_base_url()}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=body,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"DeepSeek is unreachable: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"DeepSeek returned {resp.status_code}: {resp.text[:200]}",
        )
    try:
        return resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Malformed DeepSeek response.") from exc


# ---------------------------------------------------------------------------
# POST /ai/query — natural language to GET /events filters
# ---------------------------------------------------------------------------


class AiQueryIn(BaseModel):
    question: str = Field(
        min_length=3, max_length=300, description="Natural-language question."
    )


class AiFilters(BaseModel):
    """Validated subset of `GET /events` parameters available to the model.

    Unknown fields are discarded, and bounds mirror the public endpoint as a
    defensive validation layer.
    """

    model_config = ConfigDict(extra="ignore")

    event_type: str | None = Field(default=None, pattern="^(earthquake|volcano)$")
    min_magnitude: float | None = Field(default=None, ge=0, le=10)
    start: datetime | None = None
    end: datetime | None = None
    near_lat: float | None = Field(default=None, ge=-90, le=90)
    near_lon: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=20_000)


class AiQueryOut(BaseModel):
    answer: str = Field(description="Short paraphrase of the interpreted question.")
    filters: AiFilters
    model: str


_QUERY_SYSTEM_PROMPT = """\
Sei il traduttore di query di DataPulse, una console di monitoraggio geo-tettonico
(terremoti USGS + attività vulcanica Smithsonian GVP).

Converti la domanda dell'utente in un JSON con questa forma esatta:
{"answer": "<parafrasi in italiano, una frase>", "filters": {...}}

Campi ammessi in "filters" (ometti quelli non pertinenti):
- "event_type": "earthquake" | "volcano"
- "min_magnitude": numero (solo terremoti)
- "start", "end": istanti ISO 8601 UTC (calcolali dall'ora corrente fornita)
- "near_lat", "near_lon", "radius_km": ricerca di vicinanza; se l'utente nomina
  un luogo (es. "Giappone", "Islanda") stimane le coordinate del centro e un
  raggio ragionevole (paese ~1000-2000 km, regione ~300-800 km, città ~150 km).

Regole:
- Rispondi SOLO con il JSON, nessun testo extra.
- Non inventare filtri non richiesti; niente start/end se l'utente non parla di tempo.
- "answer" descrive cosa mostrerai (es. "Terremoti M≥5 vicino al Giappone negli ultimi 7 giorni").
"""


@router.post("/query", response_model=AiQueryOut)
async def ai_query(body: AiQueryIn) -> AiQueryOut:
    """Translate a question into validated `GET /events` filters."""
    now_iso = datetime.now(UTC).isoformat(timespec="seconds")
    content = await _chat(
        [
            {"role": "system", "content": _QUERY_SYSTEM_PROMPT},
            {"role": "user", "content": f"Ora corrente (UTC): {now_iso}\nDomanda: {body.question}"},
        ],
        json_mode=True,
    )
    try:
        parsed = json.loads(content)
        filters = AiFilters.model_validate(parsed.get("filters") or {})
        answer = str(parsed.get("answer") or "").strip() or "Filtri applicati."
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="The AI produced invalid filters.") from exc

    # Proximity fields follow the same all-or-none rule as GET /events.
    near = (filters.near_lat, filters.near_lon, filters.radius_km)
    if any(v is not None for v in near) and any(v is None for v in near):
        filters.near_lat = filters.near_lon = filters.radius_km = None

    return AiQueryOut(answer=answer, filters=filters, model=deepseek_model())


# ---------------------------------------------------------------------------
# GET /ai/briefing — concise briefing from real data
# ---------------------------------------------------------------------------


class BriefingOut(BaseModel):
    briefing: str
    generated_at: datetime
    model: str
    cached: bool


# Module-level cache: {"text", "generated_at", "expires_monotonic"}.
_briefing_cache: dict | None = None


def _top_quakes_24h(session: Session, limit: int = 5) -> list[Event]:
    since = datetime.now(UTC) - timedelta(hours=24)
    stmt = (
        select(Event)
        .where(Event.event_type == "earthquake", Event.occurred_at >= since)
        .order_by(Event.magnitude.desc().nulls_last())
        .limit(limit)
    )
    return list(session.scalars(stmt).all())


@router.get("/briefing", response_model=BriefingOut)
async def ai_briefing(session: Annotated[Session, Depends(get_session)]) -> BriefingOut:
    """Return a 2–4 sentence Italian briefing from real aggregates, cached for 15 minutes."""
    global _briefing_cache
    if _briefing_cache and time.monotonic() < _briefing_cache["expires_monotonic"]:
        return BriefingOut(
            briefing=_briefing_cache["text"],
            generated_at=_briefing_cache["generated_at"],
            model=deepseek_model(),
            cached=True,
        )

    stats = compute_stats(session)
    top = _top_quakes_24h(session)
    top_lines = [
        f"- M{ev.magnitude:.1f} {ev.place or ev.title} "
        f"({ev.occurred_at.isoformat(timespec='minutes')})"
        for ev in top
        if ev.magnitude is not None
    ]
    facts = (
        f"Eventi 24h: {stats['events_24h']} (di cui terremoti: {stats['earthquakes_24h']})\n"
        f"Eventi 7g: {stats['events_7d']}\n"
        f"Magnitudo massima 24h: {stats['max_magnitude_24h'] or 'n/d'}\n"
        f"Vulcani attivi 7g: {stats['active_volcanoes_7d']}\n"
        f"Terremoti principali 24h:\n" + ("\n".join(top_lines) or "- nessuno rilevante")
    )
    text = await _chat(
        [
            {
                "role": "system",
                "content": (
                    "Sei l'analista di turno di DataPulse (monitoraggio sismico e "
                    "vulcanico). Scrivi un SITREP in italiano di 2-4 frasi, tono "
                    "asciutto da sala operativa, SOLO dai dati forniti: niente "
                    "numeri inventati, niente allarmismo, niente markdown."
                ),
            },
            {"role": "user", "content": facts},
        ]
    )

    generated_at = datetime.now(UTC)
    _briefing_cache = {
        "text": text.strip(),
        "generated_at": generated_at,
        "expires_monotonic": time.monotonic() + BRIEFING_TTL_SECONDS,
    }
    return BriefingOut(
        briefing=text.strip(), generated_at=generated_at, model=deepseek_model(), cached=False
    )
