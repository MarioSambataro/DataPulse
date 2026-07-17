"""Live Server-Sent Events feed at `GET /events/stream`.

SSE pushes newly ingested rows using an `ingested_at` watermark. The server polls
the database at a configurable interval, sends keepalive comments when idle, and
sets an initial EventSource retry delay. Each poll uses a short-lived session in a
worker thread, so a database connection is never held for the stream lifetime.
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
    """Read new events in a short-lived session and return payload plus watermark."""
    # Local import lets tests replace the session factory.
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
        Query(description="Initial ingested_at watermark; defaults to the current time."),
    ] = None,
) -> StreamingResponse:
    """Stream events ingested after `since`, defaulting to new arrivals only."""
    from api.config import stream_max_lifetime_seconds, stream_poll_seconds

    poll = stream_poll_seconds()
    max_lifetime = stream_max_lifetime_seconds()
    watermark = since or datetime.now(UTC)

    async def generate():
        nonlocal watermark
        deadline = anyio.current_time() + max_lifetime
        yield "retry: 5000\n\n"
        while True:
            # Periodic closure avoids zombie connections; EventSource reconnects.
            if anyio.current_time() >= deadline:
                return
            if await request.is_disconnected():
                return
            try:
                payload, watermark = await anyio.to_thread.run_sync(_fetch_since, watermark)
            except Exception:
                # A transient database outage is signalled without killing the feed.
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
            # Disable buffering by compatible reverse proxies such as nginx.
            "X-Accel-Buffering": "no",
        },
    )
