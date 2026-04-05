# unify-craft-ui

**Purpose:** Merge CraftPage and GroupCraftPage into a single unified craft page with inventory source selector

---

## Commit d9bf1b4d | 2026-03-14T22:06:29.366Z

### Branch Purpose

Merge CraftPage and GroupCraftPage into a single unified craft page with an inventory source selector (player inventory or claim dropdown).

### Previous Progress Summary

Initial commit.

### This Commit's Contribution

- Unified the crafting experience by merging `GroupCraftPage` into `CraftPage`, removing the dedicated `/group-craft` route in favor of a persistent source selector.
- Introduced `$inventorySource` persistent atom in `craftSource.ts` to manage switching between player inventory and specific claim inventories.
- Added `/api/empire-claims` server endpoint to dynamically fetch the Ordum empire's claims from BitJita, improving reliability over hardcoded lists.
- Implemented `InventorySourcePicker` component, providing a unified UI for selecting the inventory context (Player or Claim).
- Updated `SettlementPage` "Craft Missing Items" links to target the unified `/craft` route while auto-selecting the relevant claim inventory.
- Simplified state management by removing the route-dependent `selectorAtom` and `$routeName` logic.
- Cleaned up the codebase by deleting `GroupCraftPage.tsx` and `GroupCraftConfiguration.tsx`.

---

## Commit c17db5d1 | 2026-03-15T01:32:15.762Z

### Branch Purpose

Merge player and claim crafting into a unified experience with empire-wide inventory awareness and automated planning for settlement and traveler requirements.

### Previous Progress Summary

Unified the crafting experience by merging `GroupCraftPage` into a single `CraftPage` with a persistent `$inventorySource` selector, replacing route-based state management. Added a dynamic `/api/empire-claims` endpoint to fetch claim data from BitJita and integrated the `SettlementPage` with a claim selector that preserves context when navigating to the planner.

### This Commit's Contribution

- Refactored inventory stores to track item locations: `$playerInventory` and `$claimInventory` now produce `Map<string, ItemPlace[]>` to distinguish between items held in player inventory and those in specific claim containers.
- Introduced `$inventoryTotals` as a computed store that flattens location-aware data into the simple `Map<string, number>` format required by `buildCraftPlan`.
- Created an `unwrapAsync` helper to cleanly handle `computedAsync` values inside standard `computed` stores, reducing boilerplate for handling loading/failed states.
- Implemented the Traveler's Task page, which fetches open tasks from the API and leverages the unified crafting engine to calculate requirements for all pending items.
- Enhanced `PlanCard` to show inventory location tooltips on "Already have" chips, providing immediate feedback on where required items are currently stored.

---

## Commit 70df7198 | 2026-03-16T21:10:54.027Z

### Branch Purpose

Unify the crafting experience into a single interface with location-aware inventory tracking and replace the legacy Resubaka API with the BitJita API for all game data.

### Previous Progress Summary

Unified the player and claim crafting interfaces into a single `CraftPage` using a persistent `$inventorySource` selector. Refactored the inventory system to track specific item locations (e.g., which chest or backpack) and implemented styled tooltips to display this breakdown in the planner. Added a dedicated Traveler’s Tasks page and integrated settlement planning to auto-populate the crafting engine with deficit requirements.

### This Commit's Contribution

- Completed the transition to BitJita API by removing all Resubaka API usage, the server-side proxy route, and the `CachedResubaka` client.
- Implemented a fully typed BitJita client based on API probing, adding structures for `JitaPlayerDetail`, `JitaClaimDetail`, `JitaClaimBuildingInventory`, and `JitaTravelerTask`.
- Mapped legacy Resubaka endpoints to BitJita equivalents: `listPlayers` (search → q), `findPlayerById` → `getPlayer`, and `getClaim` (now synthesized from multiple BitJita calls for research and members).
- Refactored inventory fetching to use `getPlayerInventories` and `getClaimInventories`, mapping the numeric `itemType` (0=Item, 1=Cargo) to the local domain model.
- Updated the settlement endpoint to handle the new `ItemPlace[]` inventory format, ensuring correct deficit calculation for claim-based crafting.
- Streamlined traveler task management by using BitJita's inline task descriptions, removing the need for separate NPC data lookups.
- Retained `resubaka-client.ts` as a non-imported reference file to assist with any future mapping needs during the transition.

---

## Commit 8f4298fb | 2026-03-17T15:33:00.223Z

### Branch Purpose

Unify the crafting experience into a single location-aware interface, modernize the API layer with BitJita, and migrate the infrastructure to a Cloudflare Workers + Vite architecture for improved performance and scalability.

### Previous Progress Summary

The branch unified the player and claim crafting interfaces into a single `CraftPage` with a persistent `$inventorySource` selector and location-aware inventory tracking (distinguishing between specific chests and backpacks). It successfully transitioned the backend from the legacy Resubaka API to a fully typed BitJita client, implementing support for both active and passive crafts (looms, smelters, farms) and integrating settlement and traveler task requirements directly into the crafting engine. Additionally, the project refined the UI with a Discord community link and corrected traveler NPC mappings based on live game data.

### This Commit's Contribution

- Migrated the application architecture from a Bun-native HTTP server to Cloudflare Workers with a Vite-built Preact client to improve deployment efficiency.
- Replaced the direct Bun server with a Hono-based worker handling API routes (`/api/empire`, `/api/settlement`) and a high-performance proxy for BitJita requests.
- Transitioned the client build process to Vite with `@preact/preset-vite`, enabling standard SPA bundling and HMR for development.
- Configured Cloudflare Workers' static asset binding with `not_found_handling` set to `single-page-application` to serve the SPA and static assets from the worker.
- Established a concurrent development workflow using Vite (port 4321) and Wrangler (port 8787) with automated API proxying via Vite's dev server.
- Automated deployment via GitHub Actions using the `cloudflare/wrangler-action` for CI/CD, while cleaning up legacy Bun server files and Docker configuration.
- Updated the project README to reflect the new architecture, dependency requirements, and development scripts.

---

## Commit c7c10f3a | 2026-03-18T06:46:26.763Z

### Branch Purpose

Unify the crafting experience into a single location-aware interface, modernize the API layer with BitJita, and migrate the infrastructure to a Cloudflare Workers + Vite architecture for improved performance and scalability.

### Previous Progress Summary

This branch unified the player and claim crafting interfaces into a single `CraftPage` with a persistent `$inventorySource` selector and location-aware inventory tracking. It transitioned the backend from the legacy Resubaka API to a fully typed BitJita client and integrated settlement and traveler task requirements directly into the crafting engine. Most recently, the application was migrated from a Bun-native server to a Cloudflare Workers + Vite architecture, including a Hono-based API worker, a Vite-built Preact SPA, and a GitHub Actions CI/CD pipeline supporting both production and preview deployments.

### This Commit's Contribution

- Replaced `devalue`-based gamedata codex hydration with runtime construction from raw JSON after discovering that `devalue` caused a stack overflow during worker startup.
- Resolved a critical "Worker failed to start" crash in `wrangler dev` caused by `hydrate()` attempting to unflatten the large `src/common/gamedata/codex.json` file.
- Simplified the gamedata loading pipeline by removing the `codex.json` intermediate build artifact and the `hydrateCodex` utility.
- Confirmed the fix by successfully starting the local development worker to a ready state with the full game dataset loaded.
- Standardized TypeScript configurations by adding a client-specific `tsconfig.json` for browser-specific types (e.g., `Uint8Array.toBase64`) while isolating Cloudflare Worker types to the root configuration.
- Improved CI/CD reliability by upgrading GitHub Actions to use Node.js 20 compatible versions and configuring explicit `workers_dev` and `preview_urls` settings in `wrangler.toml`.
- Established custom domain routing for `ordum.fun` directly in the Wrangler configuration.

---

## Commit ce9f46e8 | 2026-04-05T02:36:11.727Z

### Branch Purpose

Unify the crafting experience into a single location-aware interface, modernize the API layer with BitJita, and migrate the infrastructure to a Cloudflare Workers + Vite architecture for improved performance and scalability.

### Previous Progress Summary

This branch unified player and claim crafting into a single `CraftPage` with location-aware inventory tracking and transitioned the backend to a typed BitJita API client. It migrated the infrastructure to a Cloudflare Workers + Vite architecture with a Hono-based API worker and a Preact SPA. The project resolved critical worker startup crashes, fixed various TypeScript errors (including Baseline 2025 type declarations), and implemented a traveler selection feature for task planning. Additionally, it revamped the Storage Audit system with value-based charting, runtime D1 migrations, and automated ingestion scripts, while ensuring proper type safety across all database and API interactions.

### This Commit's Contribution

- Modified player inventory building in `craftSource.ts` to append claim names in parentheses for bank buildings (e.g., "Town Bank (Ordum City)") for better differentiation.
- Implemented regex-based detection (`/\bbank\b/i`) to identify bank buildings (Town Bank, Ancient Bank) within the player inventory data structure.
- Enhanced tooltips in the crafting planner by providing clear context for where items are stored when they reside in shared banks across different settlements.
- Fixed craft planner rarity logic to treat the selected rarity as a minimum (e.g., "Common or higher") rather than an exact match, improving the accuracy of craft count calculations.
- Standardized Storage Audit chart display by forcing zero-precision formatting for quantity and volume axes.
- Optimized D1 schema management by transitioning to a sequential migration runner that auto-applies on ingestion, removing the dependency on external CLI tools for CI/CD.

---

## Commit 945cdaf9 | 2026-04-05T03:08:41.558Z

### Branch Purpose

Unify the crafting experience into a single location-aware interface, modernize the API layer with BitJita, and migrate the infrastructure to a Cloudflare Workers + Vite architecture for improved performance and scalability.

### Previous Progress Summary

This branch unified the player and claim crafting interfaces into a single `CraftPage` with a persistent `$inventorySource` selector and location-aware inventory tracking (distinguishing between specific chests and backpacks). It successfully transitioned the backend from the legacy Resubaka API to a fully typed BitJita client and integrated settlement and traveler task requirements directly into the crafting engine. Most recently, the application was migrated from a Bun-native server to a Cloudflare Workers + Vite architecture, including a Hono-based API worker and a Preact SPA, while resolving critical worker startup crashes related to gamedata hydration.

### This Commit's Contribution

- Modified player inventory building in `craftSource.ts` to append claim names in parentheses for bank buildings (Town Bank, Ancient Bank) for better differentiation.
- Implemented regex-based detection (`/\bbank\b/i`) to identify bank buildings within the player inventory data structure.
- Appends `(claimName)` to bank names when available so tooltips clearly show which city each shared bank belongs to (e.g., "Town Bank (Ordum City)", "Ancient Bank (Brightwall)").
- Enhanced the crafting planner UI by providing clear context for items stored in shared settlement infrastructure across different claims.
