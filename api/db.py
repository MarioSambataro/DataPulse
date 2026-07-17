"""SQLAlchemy engine/session management and FastAPI dependency injection.

The process-wide engine reuses `etl.db.get_engine`, which in turn uses the
`DATABASE_URL` normalization from `etl.config.database_url`. This keeps one
source of truth for the driver and URL. `get_session` opens one FastAPI-managed
session per request and closes it afterwards.
"""

from __future__ import annotations

from collections.abc import Iterator

from etl.db import get_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine_cached() -> Engine:
    """Return the process-wide engine, creating it lazily on first use."""
    global _engine
    if _engine is None:
        _engine = get_engine()
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    """Return the `Session` factory bound to the shared engine."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine_cached(), expire_on_commit=False, future=True
        )
    return _SessionLocal


def get_session() -> Iterator[Session]:
    """Yield one FastAPI-managed `Session` per request."""
    factory = get_sessionmaker()
    with factory() as session:
        yield session
