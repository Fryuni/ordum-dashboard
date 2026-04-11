/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * One-shot migration: Cloudflare D1 storage audit → Convex.
 *
 * Copies every row from the `storage_logs` and `storage_fetch_state` tables
 * in the production D1 database (`ordum-storage-audit`) into the Convex
 * `storageLogs` and `storageFetchState` tables.
 *
 * The script is idempotent:
 *   - storageLogs uses `insertLogBatch`, which dedupes by `logId`
 *   - storageFetchState uses `importFetchStateBatch`, which only inserts
 *     rows that don't already exist (rows written by the post-deploy
 *     ingestion cron are preserved)
 *
 * Running it twice (or alongside the ingestion cron) is safe.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *
 *   CONVEX_URL=https://<slug>.convex.cloud \
 *   CONVEX_DEPLOY_KEY=<production-deploy-key> \
 *     bun scripts/migrate-d1-to-convex.ts
 *
 * Requirements:
 *   - `bunx wrangler` authenticated against the CF account that owns
 *     `ordum-storage-audit` (`wrangler login`)
 *   - `CONVEX_DEPLOY_KEY` for the production Convex deployment (grab it
 *     from the Convex dashboard → Settings → Deploy Keys)
 *   - `CONVEX_URL` pointing at the production deployment
 *     (e.g. https://pleasant-toucan-590.convex.cloud)
 */
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

const D1_DATABASE = process.env.D1_DATABASE ?? "ordum-storage-audit";
const LOG_BATCH_SIZE = 250;
const D1_PAGE_SIZE = 5000;

const CONVEX_URL = requireEnv("CONVEX_URL");
const CONVEX_DEPLOY_KEY = requireEnv("CONVEX_DEPLOY_KEY");

// `ConvexHttpClient.mutation` is typed to only accept public function refs.
// `setAdminAuth` (not in the public types) lets the client call internal
// refs too — that's how the Convex CLI itself runs server-side scripts.
// We widen the types slightly at the seams below.
const rawClient = new ConvexHttpClient(CONVEX_URL);
(rawClient as unknown as { setAdminAuth(key: string): void }).setAdminAuth(
  CONVEX_DEPLOY_KEY,
);
const client = rawClient as unknown as {
  mutation(ref: unknown, args: unknown): Promise<unknown>;
};

interface StorageLogRow {
  [k: string]: unknown;
  id: string;
  claim_id: string;
  player_entity_id: string;
  player_name: string;
  building_entity_id: string;
  building_name: string;
  item_type: string;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_value: number;
  action: string;
  timestamp: string;
}

interface StorageFetchStateRow {
  [k: string]: unknown;
  claim_id: string;
  building_entity_id: string;
  newest_log_id: string | null;
  updated_at: string | null;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

/**
 * Execute a SQL query against the remote D1 database and return the rows.
 * Streams through wrangler's `--json` output.
 */
function d1Query<T extends Record<string, unknown>>(sql: string): T[] {
  const stdout = execFileSync(
    "bunx",
    [
      "wrangler",
      "d1",
      "execute",
      D1_DATABASE,
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", maxBuffer: 500 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as Array<{
    results: T[];
    success: boolean;
  }>;
  if (!parsed[0]?.success) {
    throw new Error(`D1 query failed: ${sql}`);
  }
  return parsed[0].results;
}

/** Yield all rows of a table in deterministic order, in D1_PAGE_SIZE chunks. */
function* d1Paginate<T extends Record<string, unknown>>(
  table: string,
  orderBy: string,
): Generator<T[]> {
  let offset = 0;
  while (true) {
    const rows = d1Query<T>(
      `SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT ${D1_PAGE_SIZE} OFFSET ${offset}`,
    );
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < D1_PAGE_SIZE) return;
    offset += D1_PAGE_SIZE;
  }
}

/** "YYYY-MM-DD HH:MM:SS" (UTC, SQLite default) → epoch ms. */
function parseD1DateTime(s: string | null): number | undefined {
  if (!s) return undefined;
  const ms = Date.parse(`${s.replace(" ", "T")}Z`);
  return Number.isNaN(ms) ? undefined : ms;
}

async function migrateStorageLogs(): Promise<void> {
  const countRows = d1Query<{ n: number }>(
    "SELECT COUNT(*) as n FROM storage_logs",
  );
  const total = countRows[0]?.n ?? 0;
  console.log(`storage_logs: ${total} rows in D1`);

  let processed = 0;
  for (const page of d1Paginate<StorageLogRow>("storage_logs", "timestamp")) {
    const logs = page.map((r) => ({
      logId: String(r.id),
      claimId: String(r.claim_id),
      playerEntityId: String(r.player_entity_id),
      playerName: String(r.player_name),
      buildingEntityId: String(r.building_entity_id),
      buildingName: String(r.building_name),
      itemType: String(r.item_type),
      itemId: Number(r.item_id),
      itemName: String(r.item_name),
      quantity: Number(r.quantity),
      unitValue: Number(r.unit_value ?? 0),
      action: String(r.action),
      timestamp: String(r.timestamp),
    }));

    for (let i = 0; i < logs.length; i += LOG_BATCH_SIZE) {
      const batch = logs.slice(i, i + LOG_BATCH_SIZE);
      await client.mutation(internal.storageAudit.insertLogBatch, {
        logs: batch,
      });
      processed += batch.length;
      process.stdout.write(
        `\r  storage_logs: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`,
      );
    }
  }
  process.stdout.write("\n");
}

async function migrateFetchState(): Promise<void> {
  const rows = d1Query<StorageFetchStateRow>(
    "SELECT * FROM storage_fetch_state",
  );
  console.log(`storage_fetch_state: ${rows.length} rows in D1`);

  const states = rows.map((r) => ({
    claimId: String(r.claim_id),
    buildingEntityId: String(r.building_entity_id),
    newestLogId: r.newest_log_id ? String(r.newest_log_id) : undefined,
    updatedAt: parseD1DateTime(r.updated_at),
  }));

  const result = (await client.mutation(
    internal.storageAudit.importFetchStateBatch,
    { states },
  )) as { inserted: number; skipped: number };
  console.log(
    `  storage_fetch_state: inserted ${result.inserted}, skipped (already present) ${result.skipped}`,
  );
}

async function main(): Promise<void> {
  console.log(`Migrating D1 (${D1_DATABASE}) → Convex (${CONVEX_URL})`);
  const started = Date.now();

  await migrateStorageLogs();
  await migrateFetchState();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
}

await main();
