"""API fixtures using real PostgreSQL/PostGIS with transaction isolation.

Each test runs in a dedicated transaction, clears events locally, and rolls back
afterwards. The FastAPI session dependency reuses that same session, so fixture
rows remain visible without changing persistent data.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from db.models import Event
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from api.db import get_engine_cached, get_session
from api.main import app


@pytest.fixture(scope="session")
def engine() -> Engine:
    """Return the shared test engine and verify that migrations were applied."""
    eng = get_engine_cached()
    with eng.connect() as conn:
        # Fail clearly when the test database has not been migrated.
        conn.execute(text("SELECT 1 FROM events LIMIT 0"))
    return eng


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    """Yield a session in a transaction rolled back after the test."""
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    # Start from an empty transactional view without changing persistent rows.
    session.execute(delete(Event))
    session.flush()
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """Return a TestClient bound to the transactional test session."""
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
