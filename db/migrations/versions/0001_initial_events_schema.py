"""initial events schema (PostGIS + tabella events unificata)

Revision ID: 0001
Revises:
Create Date: 2026-06-28

Abilita PostGIS, crea gli enum (source/event_type), la tabella `events` con la
colonna geografica `geom geography(Point,4326)`, gli indici (occurred_at DESC
btree, event_type btree, geom GiST) e un trigger che mantiene `geom` coerente con
`lat`/`lon`. Vedi docs/SCHEMA_EVENTI.md.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

source_enum = postgresql.ENUM("usgs", "gvp", name="source_enum", create_type=False)
event_type_enum = postgresql.ENUM(
    "earthquake", "volcano", name="event_type_enum", create_type=False
)

# Trigger: geom è SEMPRE derivata da lat/lon, qualunque sia chi scrive (ETL upsert,
# insert manuale). Così non serve passare la geometria dall'applicazione.
SYNC_GEOM_FN = """
CREATE OR REPLACE FUNCTION events_sync_geom() RETURNS trigger AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

CREATE_TRIGGER = """
CREATE TRIGGER trg_events_sync_geom
BEFORE INSERT OR UPDATE OF lat, lon ON events
FOR EACH ROW EXECUTE FUNCTION events_sync_geom();
"""


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    bind = op.get_bind()
    source_enum.create(bind, checkfirst=True)
    event_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("source", source_enum, nullable=False),
        sa.Column("event_type", event_type_enum, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column(
            "geom",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("depth_km", sa.Float(), nullable=True),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("severity", sa.Float(), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("place", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("lat BETWEEN -90 AND 90", name="ck_events_lat_range"),
        sa.CheckConstraint("lon BETWEEN -180 AND 180", name="ck_events_lon_range"),
        sa.CheckConstraint(
            "severity IS NULL OR severity BETWEEN 0 AND 1", name="ck_events_severity_range"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_events"),
    )

    op.create_index("ix_events_occurred_at", "events", [sa.text("occurred_at DESC")])
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_geom", "events", ["geom"], postgresql_using="gist")

    op.execute(SYNC_GEOM_FN)
    op.execute(CREATE_TRIGGER)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_events_sync_geom ON events")
    op.execute("DROP FUNCTION IF EXISTS events_sync_geom()")
    op.drop_index("ix_events_geom", table_name="events")
    op.drop_index("ix_events_event_type", table_name="events")
    op.drop_index("ix_events_occurred_at", table_name="events")
    op.drop_table("events")
    event_type_enum.drop(op.get_bind(), checkfirst=True)
    source_enum.drop(op.get_bind(), checkfirst=True)
    # L'estensione postgis NON viene rimossa: può essere usata da altri oggetti.
