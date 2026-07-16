"""Feed live Server-Sent Events: `GET /events/stream`.

Push dei NUOVI eventi (watermark su `ingested_at`) senza WebSocket: SSE è
unidirezionale, passa ovunque (HTTP puro), e `EventSource` lato browser fa
retry automatico. Il server fa polling interno del DB (default 5s, env
`EVENTS_STREAM_POLL_SECONDS`) — con i cron ETL orari è più che sufficiente e
tiene il design semplice (niente LISTEN/NOTIFY, niente broker).

Protocollo:
  - `event: events`  + `data: [Event, ...]`    → nuovi eventi ingeriti;
  - commento keepalive (`: ka`) a ogni giro a vuoto, così proxy e client
    distinguono "nessuna novità" da "connessione morta";
  - `retry: 5000` iniziale per il backoff dell'EventSource.

Le query girano in thread (`anyio.to_thread`) con una sessione APERTA E CHIUSA
per ciclo: mai tenere una connessione DB parcheggiata per la vita dello stream.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated

import anyio
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from api.queries import events_since
from api.schemas import Event as EventSchema

router = APIRouter(tags=["events"])


def _fetch_since(watermark: datetime) -> tuple[list[dict], datetime]:
    """Legge i nuovi eventi in una sessione usa-e-getta; ritorna (payload, watermark)."""
    # Import locale per permettere ai test di sostituire la session factory.
    from api.db import get_sessionmaker

    with get_sessionmaker()() as session:
        rows = events_since(session, watermark)
        payload = [
            EventSchema.model_validate(row).model_dump(mode="json") for row in rows
        ]
        if rows:
            watermark = max(row.ingested_at for row in rows)
        return payload, watermark


@router.get("/events/stream")
async def stream_events(
    request: Request,
    since: Annotated[
        datetime | None,
        Query(description="Watermark iniziale su ingested_at (default: adesso)."),
    ] = None,
) -> StreamingResponse:
    """Stream SSE dei nuovi eventi ingeriti dopo `since` (default: da adesso in poi)."""
    from api.config import stream_max_lifetime_seconds, stream_poll_seconds

    poll = stream_poll_seconds()
    max_lifetime = stream_max_lifetime_seconds()
    watermark = since or datetime.now(UTC)

    async def generate():
        nonlocal watermark
        deadline = anyio.current_time() + max_lifetime
        yield "retry: 5000\n\n"
        while True:
            # Chiusura periodica lato server (l'EventSource si riconnette da solo):
            # niente connessioni zombie e generatore sempre terminante.
            if anyio.current_time() >= deadline:
                return
            if await request.is_disconnected():
                return
            try:
                payload, watermark = await anyio.to_thread.run_sync(_fetch_since, watermark)
            except Exception:
                # DB momentaneamente giù: non uccidere lo stream, segnala e riprova.
                yield ": db-error\n\n"
                await anyio.sleep(poll)
                continue
            if payload:
                yield f"event: events\ndata: {json.dumps(payload)}\n\n"
            else:
                yield ": ka\n\n"
            await anyio.sleep(poll)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disattiva il buffering di eventuali reverse proxy (nginx).
            "X-Accel-Buffering": "no",
        },
    )
