## Brain — Agent Memory

This project uses Brain for agent memory management.

**Start here when orienting:** Read `.memory/main.md` for the project roadmap, key decisions, and open problems.
Read `.memory/AGENTS.md` for the full Brain protocol reference.
Tools: memory_commit, memory_branch (create/switch/merge)

## Client State Management

Always use **Nanostores** for client-side state. Prefer `persistentAtom` for user selections, `computedAsync` for API-driven data, and `computed` for derived state. Avoid `useState`/`useEffect` for data fetching — use stores instead so state is shared across pages and components.
