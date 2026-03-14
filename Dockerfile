FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM debian AS gamedata

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts scripts

RUN bash scripts/update-gamedata.sh

FROM base AS build

# Copy source and build
COPY . .
COPY --from=gamedata /app/gamedata ./gamedata
RUN bun run build

# --- Production stage ---
FROM oven/bun:1-slim AS production

WORKDIR /app/dist

# Copy built output (server + client bundle, all self-contained)
COPY --from=build /app/dist .

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["bun", "run", "server.js"]
