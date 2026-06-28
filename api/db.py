"""Engine/session SQLAlchemy dell'API + dependency injection FastAPI.

L'engine è **condiviso** (creato una sola volta) e riusa `etl.db.get_engine`, che
a sua volta riusa la normalizzazione `DATABASE_URL` -> psycopg v3 di
`etl.config.database_url`: un solo punto di verità per driver/URL, niente
duplicazioni. `get_session` è la dependency FastAPI: apre una `Session` per
richiesta e la chiude al termine.
"""

from __future__ import annotations

from collections.abc import Iterator

from etl.db import get_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine_cached() -> Engine:
    """Engine condiviso a livello di processo (creato pigramente al primo uso)."""
    global _engine
    if _engine is None:
        _engine = get_engine()
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    """Factory di `Session` legata all'engine condiviso."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine_cached(), expire_on_commit=False, future=True
        )
    return _SessionLocal


def get_session() -> Iterator[Session]:
    """Dependency FastAPI: una `Session` per richiesta, chiusa a fine richiesta."""
    factory = get_sessionmaker()
    with factory() as session:
        yield session
