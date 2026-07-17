"""Shared ETL configuration without heavyweight runtime dependencies."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Public USGS Earthquake API endpoint; no API key is required.
USGS_QUERY_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

# Smithsonian Weekly Volcanic Activity Report. Each RSS item contains the volcano
# number and coordinates, so no separate location dataset is required.
GVP_WEEKLY_RSS_URL = "https://volcano.si.edu/news/WeeklyVolcanoRSS.xml"

# The 24-hour source window covers the hourly schedule and recovers missed runs.
DEFAULT_WINDOW_HOURS = 24

# Load `.env` once from the repository root.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def database_url() -> str:
    """Return `DATABASE_URL` normalized for the psycopg v3 SQLAlchemy dialect."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env or export the "
            "variable before running ETL jobs."
        )
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url
