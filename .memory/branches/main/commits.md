# main

**Purpose:** Main project memory branch

---

## Commit 3f11d6ac | 2026-03-08T00:21:13.562Z

### Branch Purpose
The `main` branch serves as the primary development track for the Ordum Dashboard, focused on building a TypeScript API client generated directly from the [bitcraft-hub](https://github.com/ResuBaka/bitcraft-hub) Rust source code.

### Previous Progress Summary
Initial commit.

### This Commit's Contribution
- Developed a robust TypeScript API client generator (`generate-api-client.ts`) that fetches and parses Rust source code directly from GitHub at runtime, avoiding hard-coded endpoints.
- Implemented a custom bracket-aware Rust parser to handle nested generics (e.g., `Option<Vec<T>>`), module-path types, and cross-module handler resolution.
- Generated a production-ready client with 33 endpoints and 46 strictly typed interfaces, including deduplication logic for routes aliasing the same handler.
- Verified client functionality against the production API (`craft-api.resubaka.dev`) using a dedicated test suite (`test-api-client.ts`).
- Established a clean separation between internal server structs and public API models to ensure a stable and usable developer interface.
- Confirmed the current REST implementation is feature-complete, setting the stage for implementing topic-based WebSocket updates.

---

## Commit d03f1e86 | 2026-03-08T00:24:53.713Z

### Branch Purpose
Development of the Ordum Dashboard, centered on a high-fidelity TypeScript API client automatically generated from the Bitcraft Hub Rust source code.

### Previous Progress Summary
The project established a robust foundation by creating an automated TypeScript API client generator that fetches Rust source code directly from GitHub. This tool uses a custom bracket-aware parser to handle complex Rust patterns, producing a strictly-typed client for the REST API. The generator successfully emitted 33 endpoints and 46 models, which were verified against the production API to confirm a stable, feature-complete REST implementation.

### This Commit's Contribution
- Extended the generator to support real-time data by parsing Rust's `WebSocketMessages` enum and its associated topic mapping logic.
- Implemented a stateful WebSocket client that manages automatic reconnection and persists topic subscriptions across connection cycles.
- Resolved type-mapping challenges for complex Rust enum variants, including multi-field tuples and inline struct payloads, into a clean TypeScript discriminated union.
- Verified production compatibility for the live-data stream, confirming the server's topic-based pub/sub model integrates correctly with the generated client.
- Enhanced the generator's entity model coverage to include missing state types required for comprehensive live update handling.
- Confirmed the end-to-end reliability of the typed subscription system through live testing against the production environment.

---

## Commit c017ab9f | 2026-03-08T19:18:00.425Z

### Branch Purpose

The `main` branch is the primary development track for the Ordum Dashboard, a tool for aggregating and visualizing Bitcraft game data (claims, inventories, members, and resources) via a generated TypeScript API client.

### Previous Progress Summary

The project established a robust foundation by creating an automated TypeScript API client generator that fetches Rust source code directly from GitHub, using a custom bracket-aware parser to handle complex patterns. This resulted in a strictly-typed client for the REST API (33 endpoints, 46 models) and a stateful WebSocket client (26 message types) with automatic reconnection and typed subscriptions, both of which were verified against the production API.

### This Commit's Contribution

- Switched to string-based entity IDs for all API interactions to prevent 64-bit integer precision loss in JavaScript's `Number` type.
- Decided to implement a custom raw `fetch` layer for critical entity data after discovering that the generated client's standard JSON parsing mangled large Bitcraft IDs.
- Established a multi-source inventory aggregation strategy that unifies building storage, active player inventories, and offline player data into a single searchable resource pool.
- Implemented a client-side filtering and sorting architecture to handle large datasets (hundreds of members and resource types) efficiently without server round-trips.
- Determined that the production API lacks an explicit "empire" endpoint, necessitating a client-side claim aggregation model for the Ordum Empire.
- Developed a tabbed organizational structure for claims to separate building logistics from player-specific inventories and member skill rankings.
- Verified that the `getClaim` endpoint provides sufficient granularity for tracking item locations down to specific buildings within a claim.

---

## Commit 4948f2b5 | 2026-03-09T01:41:42.660Z

### Branch Purpose

Development of the Ordum Empire Dashboard for Bitcraft, providing deep insights into empire resources, settlement upgrade requirements, and complex crafting logistics using a generated API client and integrated static game data.

### Previous Progress Summary

The project established a robust foundation by building an automated TypeScript API client generator that parses Rust source code directly from GitHub to produce strictly-typed REST and WebSocket clients. It resolved critical data integrity issues by adopting string-based entity IDs to prevent 64-bit integer precision loss and implemented a multi-source inventory aggregation strategy. This unified building storage, player inventories, and member skill rankings into a searchable dashboard optimized for multi-claim empire management.

### This Commit's Contribution

- Integrated 14 static game data files (items, recipes, techs) via a new automated update script to provide offline context and requirements for live API data.
- Transitioned the application from SSG to SSR (Server-Side Rendering) using the Astro Node.js adapter to support dynamic API routes and heavy server-side data processing.
- Decided to implement crafting and search logic as server-side API routes to avoid shipping the large game data index (7K+ items/recipes) to the client.
- Built a recursive craft planner with cycle detection (handling Package/Unpack loops) and configurable depth limits to resolve full production trees from raw materials.
- Developed a settlement planner that identifies research deficits by comparing live claim inventory against tiered game data requirements.
- Implemented a JSON-based indexing layer for game data to enable efficient O(1) lookups of item dependencies and recipe outputs across the entire library.
- Added a global navigation system and dedicated pages for settlement planning and crafting logistics to unify the dashboard experience.

---

## Commit 7b35d258 | 2026-03-11T01:43:01.172Z

### Branch Purpose

Development of the Ordum Empire Dashboard for Bitcraft, providing deep insights into empire resources, settlement upgrade requirements, and complex crafting logistics using a generated API client and integrated static game data.

### Previous Progress Summary

The project established a robust foundation with a custom TypeScript API client generator for REST and WebSocket interfaces, strictly typed from Rust source code and utilizing string-based IDs for data integrity. The dashboard evolved into a sophisticated SSR-enabled tool featuring a recursive craft planner with cycle detection and a settlement research deficit tracker, both integrated with comprehensive static game data. Recent iterations refined the user experience through a complete UI overhaul optimized for information density, a conversion to Svelte 5 for fine-grained reactivity, and the implementation of a keyboard-driven autocomplete system for item management.

### This Commit's Contribution

- Adopted the `computedAsync` pattern by integrating a development version of `nanostores` (PR #383) to handle asynchronous state more declaratively.
- Replaced custom API endpoints with Astro Actions, leveraging unified server-side logic and Zod-based input validation for improved robustness and type safety.
- Refactored state management to utilize `AsyncValue` stores, deriving the craft plan directly from a request trigger atom to eliminate manual loading and error flags.
- Decomposed the monolithic craft planner into a modular hierarchy of eight focused components, separating configuration logic from plan visualization.
- Enhanced the UI architecture by creating specialized components for crafting steps and raw material summaries, improving overall maintainability.
- Decided to move toward a "thin orchestrator" pattern for the main planner component to simplify data flow and component testing.
- Streamlined the reactive data flow between the UI and backend, ensuring that craft plans and search results respond automatically to state changes.

---

## Commit a3552c42 | 2026-03-11T03:03:26.284Z

### Branch Purpose

Dashboard for the Ordum empire in Bitcraft, utilizing a generated TypeScript API client and static game data to provide deep insights into resources, settlement research, and crafting logistics.

### Previous Progress Summary

The project established a robust foundation with a custom TypeScript API client generator for REST and WebSocket interfaces, strictly typed from Rust source code and utilizing string-based IDs for data integrity. The dashboard evolved into a sophisticated SSR-enabled tool featuring a recursive craft planner with cycle detection and a settlement research deficit tracker, integrated with comprehensive static game data. Recent iterations refined the user experience through a Svelte 5 conversion for fine-grained reactivity, the adoption of `computedAsync` for declarative async state, and a complete modular refactor of the craft planner into focused components using Astro Actions for type-safe server logic.

### This Commit's Contribution

- Eliminated the manual "Calculate" trigger in the craft planner, making plan generation fully reactive to changes in targets or player context by leveraging `computedAsync` stores.
- Implemented a polished loading UX for the craft planner, featuring a center-aligned spinner and a fading effect on stale results to prevent jarring content flashes during updates.
- Resolved a critical gap in recipe resolution by indexing "Output" items that resolve via item lists, correctly connecting resources like Rough Wood Logs to their gathered origins.
- Enhanced the `addTarget` logic to automatically merge duplicate items by summing quantities rather than creating separate entries.
- Refined the game data parser to build a reverse index of resolved outputs, allowing the recursive planner to trace recipes through item list indirection.
- Formally adopted a workflow requirement to git-commit the `.memory/` directory after every agent memory checkpoint to ensure memory state is tracked in version control.
- Improved UI resilience by implementing styled error banners and better state handling for failed async computations.
