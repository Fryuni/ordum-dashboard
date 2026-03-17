# Ordum Dashboard

A web dashboard for the **Ordum** empire in [Bitcraft](https://bitcraftonline.com/), providing resource tracking, settlement planning, and crafting tools.

Built with [Preact](https://preactjs.com/) + [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/), powered by live data from the [BitJita](https://bitjita.com) API.

**Live:** [https://ordum.fun](https://ordum.fun)

## Features

### 📊 Empire Dashboard (`/`)

Overview of the Ordum empire's resources across all claims:

- Building storage inventory (excluding personal bank storage)
- Member list with permissions
- Searchable, sortable, and filterable tables

### 🏰 Settlement Planner (`/settlement`)

Track settlement upgrade progress across tiers 1–10:

- Visual timeline showing completed, active, and upcoming tiers
- Item requirements for the next tier upgrade with progress bars
- Available vs required quantities from claim building storage

### ⚒️ Craft Planner (`/craft`)

Calculate full crafting trees from raw materials:

- Search 7,000+ items and cargo by name
- Recursive recipe resolution down to raw (gathered) materials
- Handles recipe cycles (packaging, farming loops) gracefully
- Topologically sorted crafting steps — dependencies always come first
- Player/claim inventory-aware: shows what you already have
- Shareable crafting plans via URL

### 🧳 Traveler Tasks (`/traveler-task`)

View and track traveler task requirements and rewards.

## Tech Stack

| Layer     | Technology                                                                                 |
| --------- | ------------------------------------------------------------------------------------------ |
| UI        | [Preact](https://preactjs.com/) (TSX) SPA                                                 |
| State     | [nanostores](https://github.com/nanostores/nanostores) with `computedAsync`                |
| Server    | [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/)         |
| Build     | [Vite](https://vite.dev/) (client), [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (worker) |
| API       | Auto-generated [BitJita](https://bitjita.com) TypeScript client (77 endpoints)             |
| Game Data | Static JSON from [BitCraft_GameData](https://github.com/BitCraftToolBox/BitCraft_GameData) |
| Styling   | Vanilla CSS with custom properties                                                         |
| CI/CD     | GitHub Actions → Cloudflare Workers                                                        |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.3+ (or Node.js 22+)

### Installation

```bash
git clone https://github.com/user/ordum-dashboard.git
cd ordum-dashboard
bun install
./scripts/update-gamedata.sh
```

### Development

Start both the Vite dev server (client HMR) and Wrangler dev server (Worker API):

```bash
bun dev
```

- **Client (Vite):** `http://localhost:4321` — with HMR, proxies API calls to worker
- **Worker (Wrangler):** `http://localhost:8787` — API routes + static asset serving

Or run them separately:

```bash
bun run dev:worker   # Wrangler on :8787
bun run dev:client   # Vite on :4321
```

### Production Build & Preview

```bash
bun run build        # Build client with Vite
bun run preview      # Preview with Wrangler (serves worker + built client assets)
```

### Deploy

```bash
bun run deploy       # Build client + deploy worker to Cloudflare
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment variables (or `wrangler login`).

## Project Structure

```
src/
  worker.ts                             — Cloudflare Worker entry (Hono app)
  server/
    api-server.ts                       — Cached BitJita API client (server-side)
    ordum-data.ts                       — Empire data aggregation
  client/
    index.html                          — SPA entry HTML
    client.tsx                          — Preact render entry
    App.tsx                             — Root component with routing
    pages/                              — Page components
    components/                         — Shared UI components
    stores/                             — Nanostores (state management)
    styles.css                          — Global styles
  common/
    api.ts                              — Shared BitJita client (browser uses /jita proxy)
    bitjita-client.ts                   — Auto-generated BitJita API client
    gamedata.ts                         — Game data parser and indexer
    craft-planner.ts                    — Recursive crafting recipe resolver
    settlement-planner.ts               — Settlement tier upgrade calculator
    claim-inventory.ts                  — Claim inventory builder
    topological-sort.ts                 — Topological sort (Tarjan SCC + Kahn's)
gamedata/                               — Static game data JSON (downloaded)
wrangler.toml                           — Cloudflare Workers configuration
vite.config.ts                          — Vite client build configuration
```

## Configuration

Empire configuration in `src/common/ordum-types.ts`:

```typescript
export const ORDUM_MAIN_CLAIM_ID = "1224979098661645606";
export const ORDUM_EMPIRE_NAME = "Ordum";
```

> **Note:** Entity IDs use string form because they exceed `Number.MAX_SAFE_INTEGER`.

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Downloads latest game data
2. Runs type checking
3. Builds the client with Vite
4. Deploys to Cloudflare Workers via Wrangler

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

## Scripts

| Command                              | Description                           |
| ------------------------------------ | ------------------------------------- |
| `bun dev`                            | Start dev servers (Vite + Wrangler)   |
| `bun run build`                      | Build client for production           |
| `bun run preview`                    | Preview production build locally      |
| `bun run deploy`                     | Build + deploy to Cloudflare Workers  |
| `bun run validate`                   | Type check                            |
| `bun run format`                     | Format all source files               |
| `./scripts/update-gamedata.sh`       | Download latest game data             |

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 Luiz Ferraz
