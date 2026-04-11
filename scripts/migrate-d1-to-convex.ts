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
 *   - storageLogs goes through `importLogsAction`, which delegates to
 *     `insertLogBatch` — it dedupes by `logId`
 *   - storageFetchState goes through `importFetchStateBatch`, which only
 *     inserts rows that don't already exist (rows written by the post-deploy
 *     ingestion cron are preserved)
 *
 * Running it twice (or alongside the ingestion cron) is safe.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *
 *   bun scripts/migrate-d1-to-convex.ts
 *
 * Requirements:
 *   - `bunx wrangler` authenticated (`wrangler login`) with access to the
 *     `ordum-storage-audit` D1 database
 *   - `bunx convex` authenticated (`bunx convex login`) against the team
 *     that owns this project's production deployment — the script invokes
 *     `bunx convex run --prod` and inherits CLI auth from ~/.convex/config.json
 */
import { execFileSync } from "node:child_process";

const D1_DATABASE = process.env.D1_DATABASE ?? "ordum-storage-audit";
// Each `convex run` invocation spawns a CLI subprocess (~1–2s overhead), so
// we bundle many logs into one call. The importLogsAction on the Convex side
// re-chunks them into 250-row mutations that fit under the 1s mutation runtime
// budget.
const LOG_BATCH_SIZE = 2000;
const D1_PAGE_SIZE = 5000;

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

/**
 * Invoke an internal Convex function against the project's production
 * deployment using local CLI auth (`~/.convex/config.json`).
 *
 * Disables codegen and typechecking to avoid re-running them on every call.
 */
function convexRunProd(
  functionName: string,
  args: Record<string, unknown>,
): unknown {
  const stdout = execFileSync(
    "bunx",
    [
      "convex",
      "run",
      "--prod",
      "--typecheck",
      "disable",
      "--codegen",
      "disable",
      functionName,
      JSON.stringify(args),
    ],
    {
      encoding: "utf8",
      // Inherit stderr so build warnings and errors land in our output.
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const trimmed = stdout.trim();
  return trimmed ? JSON.parse(trimmed) : null;
}

function migrateStorageLogs(): void {
  const countRows = d1Query<{ n: number }>(
    "SELECT COUNT(*) as n FROM storage_logs",
  );
  const total = countRows[0]?.n ?? 0;
  console.log(`storage_logs: ${total} rows in D1`);

  let processed = 0;
  let buffer: ReturnType<typeof toConvexLog>[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    convexRunProd("storageAudit:importLogsAction", { logs: buffer });
    processed += buffer.length;
    process.stdout.write(
      `\r  storage_logs: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`,
    );
    buffer = [];
  };

  for (const page of d1Paginate<StorageLogRow>("storage_logs", "timestamp")) {
    for (const row of page) {
      buffer.push(toConvexLog(row));
      if (buffer.length >= LOG_BATCH_SIZE) flush();
    }
  }
  flush();
  process.stdout.write("\n");
}

function toConvexLog(r: StorageLogRow) {
  return {
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
  };
}

function migrateFetchState(): void {
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

  const result = convexRunProd("storageAudit:importFetchStateBatch", {
    states,
  }) as { inserted: number; skipped: number };
  console.log(
    `  storage_fetch_state: inserted ${result.inserted}, skipped (already present) ${result.skipped}`,
  );
}

function main(): void {
  console.log(`Migrating D1 (${D1_DATABASE}) → Convex (prod)`);
  const started = Date.now();

  migrateStorageLogs();
  migrateFetchState();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
}

main();
