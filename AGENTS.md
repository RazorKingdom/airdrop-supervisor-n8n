# Airdrop Supervisor (n8n + Supabase) - Agent Instructions

These guidelines are for agentic coding agents operating in this repo. Keep changes minimal and aligned with the existing architecture: n8n ingests, Supabase stores, `web/` renders.

## Repo Layout

- `n8n/workflows/` - exported n8n workflows (JSON)
- `n8n/functions/` - shared helpers for n8n Code nodes (CommonJS)
- `supabase/migrations/` - Postgres migrations
- `web/` - static frontend (HTML/CSS/JS, no build step)
- `docs/plans/` - design/implementation plans

## Commands (Build / Lint / Test)

### Tests

This repo intentionally avoids heavy tooling. Current automated tests are for `n8n/functions/`.

- Run all tests:
  - `npm -C n8n/functions test`

- Run a single test file:
  - `node --test n8n/functions/normalizeAirdrop.test.js`

- Run a single test by name (Node 20+):
  - `node --test --test-name-pattern "normalizeUrl" n8n/functions/normalizeAirdrop.test.js`

### Lint / Format

No linter/formatter is configured yet.

- Do NOT introduce prettier/eslint unless explicitly requested.
- When editing, match existing style and keep diffs small.

### Local Dev

- Serve the static frontend:
  - `python3 -m http.server 8080 --directory web`
  - Open: `http://localhost:8080/`

- Run n8n (Docker required):
  - `docker compose up -d`
  - n8n UI: `http://localhost:5678/`

### Supabase

This repo stores migrations only. If you use Supabase CLI locally:

- Start/reset local:
  - `supabase start && supabase db reset`

Note: Supabase CLI is optional; agents should not assume it is installed.

## Cursor / Copilot Rules

- No `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` were found in this repo at the time of writing.

## Code Style Guidelines

### General

- Indentation: 2 spaces
- Newlines: LF
- Semicolons: use consistently in JS
- Strings: prefer single quotes in JS unless escaping is messy
- Comments: avoid; only keep if absolutely necessary (security/regex/edge cases)

### Naming Conventions

- Database (Postgres): `snake_case` table/column names
- Tags: stable, deterministic strings (examples: `Chain:Solana`, `Type:Testnet`)
- JS variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Imports / Module Style

- `n8n/functions/` is CommonJS:
  - Use `require(...)` and `module.exports = {...}`
  - Prefer Node built-ins via `node:` (e.g. `node:test`, `node:assert/strict`)
- `web/` is browser JS:
  - No bundler; use plain `<script src="app.js">`
  - No module imports unless you convert the whole frontend intentionally

### Error Handling

- Never swallow exceptions.
- Validate external input early and throw descriptive `Error` messages.
  - Example: `Missing required field: title`
- For workflow parsing:
  - If required fields/URLs are missing, drop the item rather than inserting partial garbage.

### Input Validation Rules (Hard)

Any data coming from:
- RSS items
- Telegram messages
- Web scraping
- Supabase responses

must be treated as untrusted.

- Check types and emptiness (`typeof === 'string'`, `.trim().length > 0`)
- Check arrays (`Array.isArray`)
- When parsing URLs, use `new URL(...)` inside try/catch

### Security

Frontend (`web/`):
- Never insert untrusted strings into `innerHTML` without escaping.
- Prefer DOM APIs (`createElement`, `textContent`) where possible.
- If using template strings + `innerHTML`, escape first.

Secrets:
- Never commit API keys, Supabase keys, tokens, or private URLs.
- Keep config in env vars (n8n) or local-only settings.

### Deduplication & Canonicalization

Deduplication identity is `project_url`.

Canonicalize URLs consistently:
- remove hash fragment
- remove tracking query params (`utm_*`, `ref`)
- upgrade `http` -> `https` when possible
- normalize trailing slash
- ignore short links as project identity (`t.co`, `bit.ly`, `tinyurl.com`)

### Tagging Rules

Tagging must be deterministic and cheap:
- Prefer keyword/regex matching over LLMs.
- Keep tag taxonomy stable; avoid random new tag names.

### Frontend Behavior

The frontend must remain usable even when Supabase is unreachable:
- Use mock data / empty state as fallback.
- Handle network failures without crashing.

## Workflow Management (n8n)

- Workflow source-of-truth is JSON in `n8n/workflows/`.
- When a workflow is changed in n8n UI, export and commit the updated JSON.
- Keep Code node logic small and deterministic.

## Database Migrations (Supabase)

- Migrations live under `supabase/migrations/`.
- Use `IF NOT EXISTS` for idempotency.
- Create indexes for high-cardinality and query hot paths:
  - `created_at` for ordering
  - `project_url` unique index for dedupe
  - `tags` GIN index for filtering
