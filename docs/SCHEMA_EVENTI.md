# DataPulse — Schema eventi unificato

> Un solo modello, `events`, rappresenta **sia i terremoti** (USGS) **sia i
> vulcani** (Smithsonian GVP). È il cuore "data engineer" del progetto: due
> sorgenti, cadenze e formati diversi → uno schema solo.
>
> Stack DB: **Postgres 16 + PostGIS** (`postgis/postgis:16-3.4`). Migrazioni con
> **Alembic** (cartella [`../db/migrations/`](../db/migrations/)).

---

## Tabella `events`

| Campo | Tipo SQL | Null | Note |
|-------|----------|:----:|------|
| `id` | `text` PK | no | Chiave deterministica per l'idempotenza ETL (es. `usgs:<code>`, `gvp:<num>:<week>`) |
| `source` | `source_enum` (`usgs`,`gvp`) | no | Sorgente |
| `event_type` | `event_type_enum` (`earthquake`,`volcano`) | no | Tipo evento |
| `occurred_at` | `timestamptz` | no | Istante UTC dell'evento — indice btree DESC |
| `lat` | `double precision` | no | Latitudine grezza (`-90..90`) |
| `lon` | `double precision` | no | Longitudine grezza (`-180..180`) |
| `geom` | `geography(Point,4326)` | no | Punto PostGIS — **derivato** da `lat`/`lon` (trigger), indice GiST |
| `depth_km` | `double precision` | sì | Profondità (solo terremoti) |
| `magnitude` | `double precision` | sì | Magnitudo (solo terremoti; vulcani `null`) |
| `severity` | `double precision` | sì | Metrica normalizzata `0..1` per il rendering |
| `title` | `text` | no | Label leggibile |
| `place` | `text` | sì | Regione / luogo |
| `meta` | `jsonb` | no | Campi specifici della sorgente, default `{}` |
| `ingested_at` | `timestamptz` | no | Default `now()` — quando è stato scritto in DB |

**Vincoli (CHECK):** `lat ∈ [-90,90]`, `lon ∈ [-180,180]`,
`severity ∈ [0,1] or null`.

**Indici:**

| Nome | Colonna | Tipo | A cosa serve |
|------|---------|------|--------------|
| `ix_events_occurred_at` | `occurred_at DESC` | btree | Feed/ticker "ultimi eventi", filtri temporali |
| `ix_events_event_type` | `event_type` | btree | Filtro terremoti vs vulcani |
| `ix_events_geom` | `geom` | **GiST** | Query spaziali (`ST_DWithin`, bounding box, correlazioni) |

---

## Coerenza `geom` ↔ `lat`/`lon` — scelta: **trigger di DB**

`geom` non viene mai impostata dall'applicazione: è **sempre derivata** da
`lat`/`lon` da un trigger `BEFORE INSERT OR UPDATE OF lat, lon`:

```sql
NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326)::geography;
```

**Perché il trigger (e non il calcolo lato ETL/upsert):**

- **Single source of truth:** `lat`/`lon` sono l'unica fonte; `geom` non può
  divergere, qualunque sia il percorso di scrittura (upsert ETL, fix manuale,
  futura ingestione).
- **ETL più semplice:** il job scrive solo `lat`/`lon` e non deve conoscere
  PostGIS né costruire WKB/WKT.
- **`ON CONFLICT DO UPDATE` sicuro:** aggiornando `lat`/`lon` in un upsert, il
  trigger ricalcola `geom` automaticamente.

> ⚠️ Attenzione all'ordine `(lon, lat)`: `ST_MakePoint` vuole **X=lon, Y=lat**.

---

## Mapping verso i modelli applicativi

| Livello | Artefatto | Dove |
|---------|-----------|------|
| DB / ORM | SQLAlchemy `Event` (include `geom`) | [`../db/models.py`](../db/models.py) |
| API | Pydantic v2 `Event` (espone `lat`/`lon`, **non** `geom`) | [`../api/schemas.py`](../api/schemas.py) |

Il modello API ha `from_attributes=True`, quindi si costruisce direttamente da
un'istanza ORM: `Event.model_validate(orm_obj)`. La geometria interna `geom`
resta dentro il DB e non viene mai serializzata in risposta.

I valori ammessi di `source`/`event_type` sono allineati tra ORM
(`db.models.SOURCES`/`EVENT_TYPES`) e API (`Literal` in `api.schemas`).

---

## Comandi

```bash
# 1. avvia il DB
docker compose up -d postgres

# 2. configura l'ambiente
cp .env.example .env            # PowerShell: Copy-Item .env.example .env

# 3. installa le dipendenze DB e applica le migrazioni
pip install -e ".[db]"
alembic -c db/alembic.ini upgrade head
```

`upgrade head` esegue, nella prima migrazione (`0001`):
`CREATE EXTENSION IF NOT EXISTS postgis` → enum → tabella `events` → indici →
trigger di sincronizzazione `geom`.
