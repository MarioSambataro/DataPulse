# DataPulse API production image.
#
# Build context: repository root, containing pyproject.toml and application packages.
#   docker build -t datapulse-api .
#
# psycopg[binary] bundles libpq, avoiding build toolchains in the runtime image.
# Alembic migrations run at container startup, not during image construction.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

# Copy only metadata and packages needed by the API and migrations.
# `etl` is required because api.db reuses the shared database configuration.
COPY pyproject.toml ./
COPY etl ./etl
COPY api ./api
COPY db ./db
COPY docker-entrypoint.sh ./

# Install only the API and database dependency groups.
RUN pip install ".[api,db]" \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

# Health check for Docker and Compose; Render uses healthCheckPath instead.
# Resolve $PORT at runtime so provider overrides remain valid.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,sys,urllib.request; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8000')).status==200 else 1)"

# The entrypoint optionally applies migrations, then starts Uvicorn on $PORT.
ENTRYPOINT ["./docker-entrypoint.sh"]
