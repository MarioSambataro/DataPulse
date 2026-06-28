"""Fixture dei test API: Postgres reale, isolamento per transazione.

Strategia (decisa in SEZIONE 9): si testano gli endpoint contro un Postgres+PostGIS
reale (così `ST_DWithin`, il trigger `geom` e gli enum nativi sono quelli veri).
Per non dipendere dai dati locali né sporcarli:

  - ogni test gira dentro **una transazione** aperta su una connessione dedicata;
  - all'inizio si fa `DELETE FROM events` (visibile solo dentro la transazione),
    così il test parte da DB vuoto e deterministico;
  - a fine test si fa **rollback**: i dati reali locali restano intatti.

La dependency `get_session` dell'app è sovrascritta per riusare la *stessa* sessione
del test, così l'API vede le righe inserite (non committate) nella transazione.
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
    """Engine condiviso verso il DB di test; verifica che lo schema sia migrato."""
    eng = get_engine_cached()
    with eng.connect() as conn:
        # Fallisce con un messaggio chiaro se la migrazione non è stata applicata.
        conn.execute(text("SELECT 1 FROM events LIMIT 0"))
    return eng


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    """Sessione isolata in una transazione che viene annullata a fine test."""
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    # Parti da DB vuoto (il DELETE è dentro la transazione → niente effetti reali).
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
    """TestClient con la dependency `get_session` agganciata alla sessione del test."""
    app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
