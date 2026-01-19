# Airdrop Supervisor (n8n + Supabase)

A minimal Web3 airdrop aggregation stack with a modern dark-themed UI:

- **n8n workflows** ingest signals from RSS/Telegram sources
- Data is **normalized + tagged + deduped** automatically
- **Supabase Postgres** stores the feed with efficient indexing
- **`web/`** serves a lightweight, responsive UI (static HTML/CSS/JS)

## ✨ Frontend Features

| Feature                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| 🌙 **Dark Theme**       | Modern purple/black gradient with accent colors     |
| 📐 **Masonry Layout**   | CSS Grid responsive columns (1-3 based on viewport) |
| ♾️ **Infinite Scroll**  | IntersectionObserver-based lazy loading             |
| 🏷️ **Color-coded Tags** | Chain/Type/Sector/Signal with distinct colors       |
| ⏱️ **Relative Time**    | "5m ago", "2h ago" instead of timestamps            |
| 🎨 **Chain Accents**    | ETH blue, SOL green, MATIC purple card highlights   |
| 📱 **Responsive**       | Mobile-first design with adaptive layout            |

## What's In This Repo

```
├── n8n/
│   ├── workflows/
│   │   ├── ingest-rss-airdrops.json     # RSS ingestion workflow
│   │   └── ingest-telegram-airdrops.json # Telegram ingestion skeleton
│   └── functions/
│       └── normalizeAirdrop.js          # Shared normalize/tagging helper
├── supabase/
│   └── migrations/
│       └── 0001_create_airdrops.sql     # airdrops table + indexes
├── web/
│   ├── index.html                       # Main HTML
│   ├── styles.css                       # Dark theme + masonry grid
│   └── app.js                           # Filters, infinite scroll, XSS-safe
├── scripts/
│   ├── install.sh                       # Ubuntu/Debian server setup
│   └── env.example                      # Environment template
└── docker-compose.yml                   # n8n Docker setup
```

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

By default the UI uses **12 mock airdrops**. To load real data from Supabase REST:

- Edit `web/app.js` and set:
  - `CONFIG.SUPABASE_URL` (e.g. `https://<project-ref>.supabase.co`)
  - `CONFIG.SUPABASE_ANON_KEY` (Supabase anon key)

Note: Your Supabase Row Level Security (RLS) must allow read access for the `airdrops` table (or the UI will fall back to mock data).

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

## Tag System

The n8n workflow automatically generates tags based on content:

| Category   | Examples                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| **Chain**  | `Chain:Ethereum`, `Chain:Solana`, `Chain:Arbitrum`, `Chain:zkSync`             |
| **Type**   | `Type:Testnet`, `Type:Stake`, `Type:NFT`, `Type:Mainnet`                       |
| **Sector** | `Sector:DeFi`, `Sector:GameFi`, `Sector:SocialFi`, `Sector:Layer2`             |
| **Signal** | `Signal:Airdrop`, `Signal:Retroactive`, `Signal:Confirmed`, `Signal:Potential` |

## Server Deployment

### Quick Install (Ubuntu/Debian)

```bash
# Clone the repo
git clone <your-repo-url> /opt/airdrop-supervisor
cd /opt/airdrop-supervisor

# Run installation script
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

The script will:
1. Install Docker, Node.js, and Nginx
2. Create `.env` file with generated encryption key
3. Configure Nginx to serve the frontend
4. Create systemd service for n8n

### Post-Installation

1. **Configure Supabase credentials:**
   ```bash
   sudo nano /opt/airdrop-supervisor/.env
   ```

2. **Update frontend config:**
   ```bash
   nano /opt/airdrop-supervisor/web/app.js
   # Set CONFIG.SUPABASE_URL and CONFIG.SUPABASE_ANON_KEY
   ```

3. **Apply database migration in Supabase SQL Editor**

4. **Start services:**
   ```bash
   sudo systemctl start airdrop-n8n
   sudo systemctl enable airdrop-n8n
   ```

5. **Import workflow in n8n UI** (http://your-server:5678)

### Environment Variables

| Variable               | Description                               |
| ---------------------- | ----------------------------------------- |
| `N8N_ENCRYPTION_KEY`   | n8n encryption key (auto-generated)       |
| `RSS_FEED_URL`         | RSS feed to ingest (default: airdrops.io) |
| `SUPABASE_URL`         | Your Supabase project URL                 |
| `SUPABASE_ANON_KEY`    | Supabase anon/public key                  |
| `SUPABASE_SERVICE_KEY` | Supabase service role key                 |

## Development Notes

- No eslint/prettier configured; keep diffs small and match existing style.
- Avoid committing secrets. Use env vars / local config.
- Frontend must be resilient (works without Supabase).
- All user content is XSS-escaped via `escapeHtml()`.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Layout**: CSS Grid with `auto-fill` masonry
- **Scroll**: IntersectionObserver API
- **Backend**: n8n + Supabase PostgreSQL
- **Deployment**: Docker + Nginx + systemd

## License

TBD
