# DataPulse API — immagine di produzione (SEZIONE 10).
#
# Build context = root del repo (servono pyproject.toml + i package etl/api/db).
#   docker build -t datapulse-api .
#
# psycopg[binary] include libpq: niente build-essential/libpq-dev → immagine snella.
# Le migrazioni Alembic girano all'avvio (docker-entrypoint.sh), non in fase di build.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

# Solo i metadati + i package necessari all'API e alle migrazioni (no etl/dev/web).
# `etl` serve perché api.db riusa etl.db/etl.config (single source of truth dell'URL).
COPY pyproject.toml ./
COPY etl ./etl
COPY api ./api
COPY db ./db
COPY docker-entrypoint.sh ./

# Installa SOLO i layer API + DB (uvicorn, fastapi, sqlalchemy, alembic, psycopg, ...).
RUN pip install ".[api,db]" \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

# Healthcheck per docker run / compose (Render usa invece healthCheckPath: /health).
# Legge $PORT a runtime, così resta valido anche quando il provider lo cambia.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,sys,urllib.request; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8000')).status==200 else 1)"

# L'entrypoint applica le migrazioni (RUN_MIGRATIONS=1) e poi avvia uvicorn su $PORT.
ENTRYPOINT ["./docker-entrypoint.sh"]
