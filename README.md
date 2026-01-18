# Airdrop Supervisor (n8n + Supabase)

A minimal Web3 airdrop aggregation stack:

- n8n workflows ingest signals (RSS/Telegram)
- data is normalized + tagged + deduped
- Supabase Postgres stores the feed
- `web/` serves a lightweight UI (static HTML/CSS/JS)

## What’s In This Repo

- `n8n/workflows/ingest-rss-airdrops.json`: RSS ingestion skeleton
- `n8n/workflows/ingest-telegram-airdrops.json`: Telegram ingestion skeleton
- `n8n/functions/normalizeAirdrop.js`: shared normalize/tagging helper
- `supabase/migrations/0001_create_airdrops.sql`: `airdrops` table + indexes
- `web/`: static UI with tag filtering and optional Supabase REST fetch

## Quickstart

### 1) Run tests

```bash
npm -C n8n/functions test
```

### 2) Run the web UI

```bash
python3 -m http.server 8080 --directory web
```

Open `http://localhost:8080/`.

By default the UI uses mock data. To load real data from Supabase REST:

- Edit `web/app.js` and set:
  - `CONFIG.SUPABASE_URL` (e.g. `https://<project-ref>.supabase.co`)
  - `CONFIG.SUPABASE_ANON_KEY` (Supabase anon key)

Note: your Supabase Row Level Security (RLS) must allow read access for the `airdrops` table (or the UI will fall back to mock data).

### 3) Run n8n locally (Docker)

```bash
docker compose up -d
```

Open n8n at `http://localhost:5678/`.

## Supabase Schema

This repo includes a migration for `public.airdrops` with:

- `project_url` unique index (dedupe identity)
- `created_at` index (fast latest-feed queries)
- `tags` GIN index (filtering)

Apply with Supabase CLI if you use it locally:

```bash
supabase start && supabase db reset
```

## Development Notes

- No eslint/prettier configured; keep diffs small and match existing style.
- Avoid committing secrets. Use env vars / local config.
- Frontend must be resilient (works without Supabase).

## License

TBD
