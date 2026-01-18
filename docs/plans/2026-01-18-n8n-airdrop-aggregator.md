# n8n + Supabase Airdrop Aggregator Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** Build a dynamic website that continuously ingests “wide net” Web3 airdrop signals via n8n, deduplicates and tags them, and serves them in real-time from Supabase.

**Architecture:** n8n runs scheduled ingestion workflows for multiple sources, normalizes content into a single record shape, performs URL-based dedupe, assigns tags using deterministic keyword rules, and upserts into Supabase Postgres. A simple frontend reads from Supabase (and optionally subscribes to Realtime) to show latest items and allow tag filtering.

**Tech Stack:** n8n, Supabase (Postgres + optional Auth + Realtime), Node.js/TypeScript (n8n Code nodes), Next.js (or similar) frontend, Docker Compose for local dev.

---

## Assumptions / Decisions Locked In
- Ingestion strategy: “Wide Net” aggregator (speed/volume).
- Processing: dedupe + tagging only (no deep entity extraction).
- Delivery: Dynamic app (frontend reads DB).
- Database: Supabase.

## Non-Goals (YAGNI)
- No wallet connection, claim automation, or executing transactions.
- No complex NLP extraction (project name, deadlines) in v1.
- No full moderation UI in v1.

---

## Data Model (Supabase)

### Task 1: Create `airdrops` table

**Files:**
- Create: `supabase/migrations/0001_create_airdrops.sql`

**Step 1: Write the migration SQL (no tests yet)**

```sql
-- 0001_create_airdrops.sql
create extension if not exists "uuid-ossp";

create table if not exists public.airdrops (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  source_url text not null,
  project_url text not null,
  tags text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists airdrops_project_url_unique on public.airdrops (project_url);
create index if not exists airdrops_created_at_idx on public.airdrops (created_at desc);
create index if not exists airdrops_tags_gin on public.airdrops using gin (tags);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_airdrops_updated_at on public.airdrops;
create trigger set_airdrops_updated_at
before update on public.airdrops
for each row execute function public.set_updated_at();
```

**Step 2: Apply migration locally**

Run: `supabase start && supabase db reset`
Expected: exit code 0; `airdrops` table exists.

**Step 3: Commit**

```bash
git add supabase/migrations/0001_create_airdrops.sql
git commit -m "feat: add airdrops table schema"
```

---

## n8n Workflows (Ingestion + Dedupe + Tagging)

### Task 2: Create a shared normalization + tagging function (JavaScript)

**Files:**
- Create: `n8n/functions/normalizeAirdrop.ts`
- Test: `n8n/functions/normalizeAirdrop.test.ts`

**Step 1: Write the failing test**

```ts
import { normalizeAirdrop } from './normalizeAirdrop';

describe('normalizeAirdrop', () => {
  it('normalizes URLs and generates deterministic tags', () => {
    const r = normalizeAirdrop({
      title: 'New testnet airdrop on Solana',
      description: 'Try the faucet https://example.com/?ref=abc and follow steps',
      sourceUrl: 'https://twitter.com/some/status/123',
      rawUrls: ['https://example.com/?ref=abc', 'https://t.co/xyz']
    });

    expect(r.projectUrl).toBe('https://example.com/');
    expect(r.tags).toEqual(expect.arrayContaining(['Chain:Solana', 'Type:Testnet']));
  });

  it('rejects empty project URLs', () => {
    expect(() => normalizeAirdrop({
      title: 'x',
      description: 'y',
      sourceUrl: 'https://twitter.com/a',
      rawUrls: []
    })).toThrow(/project url/i);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm -C n8n/functions test` (or `npm test` depending on setup)
Expected: FAIL because `normalizeAirdrop` not implemented.

**Step 3: Write minimal implementation**

```ts
export type NormalizeInput = {
  title: string;
  description: string;
  sourceUrl: string;
  rawUrls: string[];
};

export type NormalizeOutput = {
  title: string;
  description: string;
  sourceUrl: string;
  projectUrl: string;
  tags: string[];
};

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  // drop common tracking params
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref'].forEach((k) => u.searchParams.delete(k));
  const out = u.toString();
  // normalize trailing slash for path-only URLs
  return out.endsWith('/') ? out : out + '/';
}

function tagsFromText(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/(solana|\bsol\b)/.test(t)) tags.push('Chain:Solana');
  if (/(ethereum|\beth\b)/.test(t)) tags.push('Chain:Ethereum');
  if (/testnet|faucet/.test(t)) tags.push('Type:Testnet');
  if (/airdrop/.test(t)) tags.push('Signal:Airdrop');
  return Array.from(new Set(tags));
}

export function normalizeAirdrop(input: NormalizeInput): NormalizeOutput {
  const joined = `${input.title}\n${input.description}`;
  const candidate = input.rawUrls.find((u) => {
    try {
      const p = new URL(u);
      return p.protocol === 'http:' || p.protocol === 'https:';
    } catch {
      return false;
    }
  });
  if (!candidate) throw new Error('Missing project URL');

  return {
    title: input.title.trim(),
    description: input.description.trim(),
    sourceUrl: input.sourceUrl.trim(),
    projectUrl: normalizeUrl(candidate),
    tags: tagsFromText(joined)
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C n8n/functions test`
Expected: PASS.

**Step 5: Commit**

```bash
git add n8n/functions/normalizeAirdrop.ts n8n/functions/normalizeAirdrop.test.ts
git commit -m "feat: add url normalization and tagging helpers"
```

---

### Task 3: Implement n8n workflow: RSS ingestion (baseline)

**Files:**
- Create: `n8n/workflows/ingest-rss-airdrops.json`

**Step 1: Create the workflow (manual in n8n UI) with these nodes**
- Trigger: Cron (every 10 minutes)
- Node: RSS Read (feed list configurable)
- Node: Function/Code (extract title/description/sourceUrl/rawUrls)
- Node: Code (call normalization/tagging logic inline for v1)
- Node: Supabase (Upsert into `airdrops` using `project_url` unique index)

**Step 2: Test end-to-end in n8n**
- Run workflow once manually
- Verify in Supabase table: new records inserted, duplicates are not duplicated

**Step 3: Export workflow JSON**
- Export from UI and save to `n8n/workflows/ingest-rss-airdrops.json`

**Step 4: Commit**

```bash
git add n8n/workflows/ingest-rss-airdrops.json
git commit -m "feat: add rss ingestion workflow"
```

---

### Task 4: Implement n8n workflow: Telegram ingestion (optional v1.1)

**Files:**
- Create: `n8n/workflows/ingest-telegram-airdrops.json`

**Step 1: Create Telegram Bot & credentials**
- Create a bot via BotFather
- Add bot to target channels/groups (or use user account via MTProto if required)

**Step 2: Create workflow**
- Trigger: Telegram (new message)
- Node: Extract URLs + normalize + tags
- Node: Supabase Upsert

**Step 3: Verify**
- Send message containing a URL
- Confirm single insert in Supabase

**Step 4: Commit**

```bash
git add n8n/workflows/ingest-telegram-airdrops.json
git commit -m "feat: add telegram ingestion workflow"
```

---

## Frontend (Dynamic App)

### Task 5: Build the minimal frontend list page

**Files:**
- Create: `web/app/page.tsx`
- Create: `web/lib/supabaseClient.ts`
- Test: `web/app/page.test.tsx`

**Step 1: Write a failing UI test (minimal)**

```tsx
import { render, screen } from '@testing-library/react';
import Page from './page';

test('renders latest airdrops heading', () => {
  render(<Page />);
  expect(screen.getByText(/latest airdrops/i)).toBeInTheDocument();
});
```

**Step 2: Run the test to see it fail**

Run: `pnpm -C web test`
Expected: FAIL (Page not implemented).

**Step 3: Implement minimal page**
- Query Supabase for last 50 `airdrops` ordered by `created_at desc`
- Render title + tags + outbound links
- Add tag filter UI (simple)

**Step 4: Run tests + dev server**

Run: `pnpm -C web test`
Expected: PASS

Run: `pnpm -C web dev`
Expected: site loads and shows rows.

**Step 5: Commit**

```bash
git add web/app/page.tsx web/lib/supabaseClient.ts web/app/page.test.tsx
git commit -m "feat: add minimal airdrop list frontend"
```

---

## Ops / Deployment

### Task 6: Local dev via Docker Compose

**Files:**
- Create: `docker-compose.yml`

**Step 1: Add services**
- `n8n`
- `supabase` (or connect to hosted Supabase and skip local)
- `web`

**Step 2: Smoke test**
Run: `docker compose up -d`
Expected: n8n UI accessible; web accessible; workflows can write to Supabase.

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add local dev compose stack"
```

---

## Verification Checklist (Definition of Done)
- RSS ingestion inserts rows and dedupes by `project_url`.
- Tagging produces consistent tags for same input.
- Frontend shows latest rows and can filter by tag.
- No secrets committed (use `.env` / Supabase secrets).

---

## Notes / Edge Cases to Handle
- URL canonicalization: remove tracking params; normalize trailing slash; handle `http->https` consistency.
- Short links (`t.co`, `bit.ly`) may require expansion or be ignored.
- RSS items with no URLs should be dropped.
- Telegram messages often include multiple URLs; choose first non-shortlink candidate.
- Rate limits and timeouts: n8n nodes should have retry + backoff.
