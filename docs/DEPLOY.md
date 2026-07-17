# DataPulse — Free-tier deployment

The portfolio deployment uses the following architecture:

```text
GitHub Actions (ETL) ──upsert──► Neon PostgreSQL + PostGIS ◄──read── Render FastAPI
                                                                         ▲
                                                                         │ HTTPS/CORS
                                                               Vercel React/Vite
```

- **Persistent database:** Neon Free.
- **Backend API:** Render Free using the repository Docker image.
- **Frontend:** Vercel Hobby using the static build from `web/`.
- **ETL:** GitHub Actions for the public repository.

This setup avoids Render's time-limited free PostgreSQL service. A free Render
web service sleeps after inactivity, so its first request can take about a minute.

## 1. Prerequisites

- An up-to-date public GitHub repository.
- Free Neon, Render, and Vercel accounts.
- No committed secrets; `.env` is excluded from Git.

## 2. Neon PostgreSQL and PostGIS

1. In Neon Console, create a project.
2. Select a region close to Render, preferably Frankfurt for a European deployment.
3. Run this in the SQL Editor:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT postgis_version();
   ```

4. Copy the direct connection string from **Connect**:

   ```text
   postgresql://USER:PASSWORD@ENDPOINT.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

The connection string contains credentials and must exist only in provider secrets.

## 3. FastAPI backend on Render

`render.yaml` provisions one Docker service named `datapulse-api`.

1. In Render, choose **New → Blueprint**.
2. Connect this repository and the `main` branch.
3. Configure the environment:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Direct Neon connection string |
   | `CORS_ALLOW_ORIGINS` | Vercel origin; use `http://localhost:5173` temporarily |
   | `RUN_MIGRATIONS` | Already set to `1` in the Blueprint |

4. Apply the Blueprint.

At startup, `docker-entrypoint.sh` runs `alembic upgrade head`. This idempotent
command creates the schema, geospatial indexes, and synchronization trigger.

Verify these endpoints:

```text
https://<service>.onrender.com/health
https://<service>.onrender.com/status
https://<service>.onrender.com/docs
```

`DEEPSEEK_API_KEY` is optional. If used, add it only to Render's environment;
never expose it to Vercel or GitHub.

## 4. Frontend on Vercel

1. In Vercel, choose **Add New → Project** and import the repository.
2. Set **Root Directory** to `web`.
3. Add this build-time variable:

   ```text
   VITE_API_URL=https://<service>.onrender.com
   ```

4. Deploy. `web/vercel.json` configures Vite, the build command, and `dist` output.

After Vercel assigns the final URL, update Render with:

```text
CORS_ALLOW_ORIGINS=https://<project>.vercel.app
```

Use the exact origin with no trailing slash, then redeploy the API.

## 5. Scheduled ETL on GitHub Actions

Open **Repository → Settings → Secrets and variables → Actions** and add:

```text
Name:  DATABASE_URL
Value: Direct Neon connection string
```

Run the workflows manually in this order:

1. **ETL Earthquakes (USGS)**
2. **ETL Volcanoes (GVP)**

They continue on their configured schedules. The API and ETL use the same
database, so ingested data appears in the dashboard automatically.

## 6. End-to-end verification

1. Both ETL workflows complete successfully.
2. `GET /events?limit=2` returns records.
3. `GET /stats` returns populated counters.
4. `GET /status` reports an `ok` database and recent ingestion.
5. The frontend displays live events, the ticker, statistics, and globe markers.
6. The browser console contains no CORS errors.

## Free-tier limitations

- Render Free suspends inactive services, so the first load can be slow.
- Neon Free is appropriate for a demo, not continuous production traffic.
- Vercel Hobby is intended for personal and portfolio projects.
- A custom domain is optional, but purchasing one is not free.

The frontend explains cold starts and retries before presenting an offline state.
