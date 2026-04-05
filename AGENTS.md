## Brain — Agent Memory

This project uses Brain for agent memory management.

**Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
Read `.memory/AGENTS.md` for the full Brain protocol reference.
Tools: memory_commit, memory_branch (create/switch/merge)

## Client State Management

Always use **Nanostores** for client-side state. Prefer `persistentAtom` for user selections, `computedAsync` for API-driven data, and `computed` for derived state. Avoid `useState`/`useEffect` for data fetching — use stores instead so state is shared across pages and components.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
