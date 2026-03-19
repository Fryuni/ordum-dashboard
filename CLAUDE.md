# CLAUDE.md

## Package Manager

This project uses **bun**. Do not use npm, yarn, or pnpm.

- Install dependencies: `bun install`
- Never commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` (they are gitignored and CI will reject them).

## Common Commands

- `bun run dev` — Start dev server (worker + vite)
- `bun run build` — Build with vite
- `bun run validate` — Type check (`tsc --noEmit`)
- `bun run format` — Format with prettier
- `bun run deploy` — Build and deploy with wrangler
