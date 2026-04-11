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
 *   - `bunx convex login` — the script reads the resulting access token from
 *     `~/.convex/config.json` and mints a prod admin key on startup, then
 *     calls the internal storage-audit functions directly over HTTP. This
 *     avoids paying the ~1–2s `convex run` subprocess tax per batch and
 *     sidesteps the Linux MAX_ARG_STRLEN (128KB) per-argv-element limit that
 *     bit the earlier shell-based version.
 */
import { readFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Bun/Node block-buffer stdout when it's a pipe, which hides all progress
// until either the buffer fills or the process exits. `fs.writeSync(1, ...)`
// bypasses that buffer so every status line lands in the output stream
// immediately — essential when running this script under a task runner or
// through `bun ... 2>&1 | head`.
const log = (line: string): void => {
  writeSync(1, line.endsWith("\n") ? line : line + "\n");
};
const logInline = (line: string): void => {
  writeSync(1, line);
};
const now = (): string => new Date().toISOString();
import { $ } from "bun";
import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { internal } from "../convex/_generated/api";

// ConvexHttpClient's public TS surface restricts `action`/`mutation` to
// *public* function references and hides `setAdminAuth`. At runtime both work
// fine against internal functions with admin auth — that's how the convex CLI
// itself invokes internal functions (see cli/lib/run.js:setAdminAuth). We
// widen the type surface here rather than casting at every call site.
type AdminHttpClient = {
  setAdminAuth(token: string): void;
  action<Ref extends FunctionReference<"action", "public" | "internal">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>>;
  mutation<Ref extends FunctionReference<"mutation", "public" | "internal">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>>;
};

const D1_DATABASE = process.env.D1_DATABASE ?? "ordum-storage-audit";
// `importLogsAction` re-chunks its input into 250-row mutations internally to
// stay under the 1s mutation runtime budget, so we can afford a generous outer
// batch — the HTTP call cost is minimal compared to the per-subprocess overhead
// the previous version paid.
const LOG_BATCH_SIZE = 2000;
// `importFetchStateBatch` is a single mutation — cap at 1000 rows so the
// serialized argument stays comfortably under Convex's 16MB function arg limit
// even if future rows grow wider.
const FETCH_STATE_BATCH_SIZE = 1000;
const D1_PAGE_SIZE = 5000;

// Undocumented Convex cloud (big-brain) API — the host the CLI itself talks
// to. Overridable via CONVEX_PROVISION_HOST, matching the CLI's own escape
// hatch for staging environments.
const BIG_BRAIN_HOST =
  process.env.CONVEX_PROVISION_HOST ?? "https://api.convex.dev";

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
 * Shells out to wrangler via Bun's `$` — there's no Node/Bun client library
 * for remote D1, so subprocesses are unavoidable here. Fortunately we only
 * make ~N/D1_PAGE_SIZE of these calls total.
 */
async function d1Query<T extends Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const stdout =
    await $`bunx wrangler d1 execute ${D1_DATABASE} --remote --json --command ${sql}`
      .quiet()
      .text();
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
async function* d1Paginate<T extends Record<string, unknown>>(
  table: string,
  orderBy: string,
): AsyncGenerator<T[]> {
  let offset = 0;
  while (true) {
    const rows = await d1Query<T>(
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

interface ProdCredentials {
  adminKey: string;
  url: string;
  deploymentName: string;
}

/**
 * Replay what `convex run --prod` does internally to obtain admin credentials
 * without shelling out:
 *
 *   1. Read the big-brain access token from ~/.convex/config.json (written by
 *      `bunx convex login`).
 *   2. Look up the prod deployment name from `CONVEX_DEPLOYMENT` (Bun
 *      auto-loads `.env.local`, which the Convex CLI populates). The value is
 *      prefixed with the deployment type (e.g. `prod:name`) — we strip it the
 *      same way `stripDeploymentTypePrefix` in the CLI does.
 *   3. POST to the (undocumented) `deployment/authorize_prod` big-brain
 *      endpoint with the deployment name. The response contains `{adminKey,
 *      url}` which we can hand to ConvexHttpClient.
 *
 * This relies on Convex CLI internals. Fine for a one-shot migration script;
 * revisit if the CLI changes the endpoint shape.
 */
async function getProdCredentials(): Promise<ProdCredentials> {
  const configPath = join(homedir(), ".convex", "config.json");
  let accessToken: string | undefined;
  try {
    const raw = readFileSync(configPath, "utf8");
    accessToken = (JSON.parse(raw) as { accessToken?: string }).accessToken;
  } catch (err) {
    throw new Error(
      `Failed to read ${configPath} — run \`bunx convex login\` first. (${(err as Error).message})`,
    );
  }
  if (!accessToken) {
    throw new Error(
      `No accessToken in ${configPath} — run \`bunx convex login\` first.`,
    );
  }

  const deploymentRaw = process.env.CONVEX_DEPLOYMENT;
  if (!deploymentRaw) {
    throw new Error(
      "CONVEX_DEPLOYMENT is not set. Ensure .env.local exists (created by `bunx convex dev` / `bunx convex deploy`).",
    );
  }
  const deploymentName = deploymentRaw.split(":").at(-1);
  if (!deploymentName) {
    throw new Error(`Could not parse CONVEX_DEPLOYMENT='${deploymentRaw}'`);
  }

  const res = await fetch(`${BIG_BRAIN_HOST}/api/deployment/authorize_prod`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ deploymentName }),
  });
  if (!res.ok) {
    throw new Error(
      `authorize_prod failed: ${res.status} ${res.statusText}\n${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    adminKey?: string;
    url?: string;
    deploymentName?: string;
  };
  if (!data.adminKey || !data.url) {
    throw new Error(
      `authorize_prod returned unexpected payload: ${JSON.stringify(data)}`,
    );
  }
  return {
    adminKey: data.adminKey,
    url: data.url,
    deploymentName: data.deploymentName ?? deploymentName,
  };
}

async function migrateStorageLogs(client: AdminHttpClient): Promise<void> {
  log(`[${now()}] Counting storage_logs in D1...`);
  const countRows = await d1Query<{ n: number }>(
    "SELECT COUNT(*) as n FROM storage_logs",
  );
  const total = countRows[0]?.n ?? 0;
  log(`[${now()}] storage_logs: ${total} rows in D1`);

  let processed = 0;
  let buffer: ReturnType<typeof toConvexLog>[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    await client.action(internal.storageAudit.importLogsAction, {
      logs: buffer,
    });
    processed += buffer.length;
    logInline(
      `\r  storage_logs: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`,
    );
    buffer = [];
  };

  for await (const page of d1Paginate<StorageLogRow>(
    "storage_logs",
    "timestamp",
  )) {
    for (const row of page) {
      buffer.push(toConvexLog(row));
      if (buffer.length >= LOG_BATCH_SIZE) await flush();
    }
  }
  await flush();
  logInline("\n");
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

async function migrateFetchState(client: AdminHttpClient): Promise<void> {
  log(`[${now()}] Fetching storage_fetch_state from D1...`);
  const rows = await d1Query<StorageFetchStateRow>(
    "SELECT * FROM storage_fetch_state",
  );
  log(`[${now()}] storage_fetch_state: ${rows.length} rows in D1`);

  const states = rows.map((r) => ({
    claimId: String(r.claim_id),
    buildingEntityId: String(r.building_entity_id),
    newestLogId: r.newest_log_id ? String(r.newest_log_id) : undefined,
    updatedAt: parseD1DateTime(r.updated_at),
  }));

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < states.length; i += FETCH_STATE_BATCH_SIZE) {
    const batch = states.slice(i, i + FETCH_STATE_BATCH_SIZE);
    const result = await client.mutation(
      internal.storageAudit.importFetchStateBatch,
      { states: batch },
    );
    inserted += result.inserted;
    skipped += result.skipped;
  }
  log(
    `  storage_fetch_state: inserted ${inserted}, skipped (already present) ${skipped}`,
  );
}

async function main(): Promise<void> {
  log(`[${now()}] Starting migration — minting prod credentials...`);
  const creds = await getProdCredentials();
  log(
    `[${now()}] Migrating D1 (${D1_DATABASE}) → Convex prod (${creds.deploymentName})`,
  );
  const started = Date.now();

  const client = new ConvexHttpClient(creds.url) as unknown as AdminHttpClient;
  client.setAdminAuth(creds.adminKey);

  await migrateStorageLogs(client);
  await migrateFetchState(client);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  log(`[${now()}] Done in ${elapsed}s`);
}

await main();
