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
