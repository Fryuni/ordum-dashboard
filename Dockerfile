FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM debian AS gamedata

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts scripts

RUN bash scripts/update-gamedata.sh

FROM base AS build

# Copy source and build
COPY . .
RUN --mount=type=cache,target=/app/node_modules/.astro \
    --mount=type=cache,target=/app/node_modules/.vite \
    bun run build

# --- Production stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules

# Copy static game data (loaded at runtime)
COPY --from=gamedata /app/gamedata ./gamedata

# Copy built output and runtime dependencies
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["bun", "run", "dist/server/entry.mjs"]
