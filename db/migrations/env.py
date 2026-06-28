"""Alembic environment per DataPulse.

La URL del database viene letta da `DATABASE_URL` (caricata da `.env` se presente).
Lo schema `postgresql://...` viene normalizzato al driver psycopg v3
(`postgresql+psycopg://`). Il target metadata è quello del modello SQLAlchemy in
`db/models.py`, così l'autogenerate futuro vede la tabella `events`.
"""

from __future__ import annotations

import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from db.models import Base
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Carica .env dalla root del repo (db/ -> ..).
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

target_metadata = Base.metadata


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL non impostata. Copia .env.example in .env "
            "(o esporta la variabile) prima di lanciare Alembic."
        )
    # Forza il driver psycopg v3 mantenendo le URL 'postgresql://' nel .env.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
