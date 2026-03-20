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

import type BitJitaClient from "../common/bitjita-client";
import { gd } from "../common/gamedata";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Shape of each storage log entry from the BitJita API. */
interface StorageLogEntry {
  id: string;
  objectEntityId: string;
  subjectEntityId: string;
  subjectName: string;
  subjectType: string;
  data: {
    type: string; // "deposit_item" | "withdraw_item" | "deposit_cargo" | "withdraw_cargo"
    item_id: number;
    quantity: number;
    item_type: string; // "item" | "cargo"
  };
  timestamp: string;
  daysSinceEpoch: number;
  regionId: number;
  building: {
    entityId: string;
    buildingDescriptionId: number;
    buildingName: string;
    iconAssetName: string;
  };
}

interface ItemMeta {
  id: number;
  name: string;
  iconAssetName: string;
  tier: number;
  rarityStr: string;
  tag: string;
}

interface BuildingInfo {
  entityId: string;
  buildingName: string;
  functions: Array<{
    storage_slots?: number;
    cargo_slots?: number;
  }>;
}

export interface StorageAuditLogRow {
  id: string;
  player_entity_id: string;
  player_name: string;
  building_name: string;
  item_type: string;
  item_id: number;
  item_name: string;
  quantity: number;
  action: string;
  timestamp: string;
}

export interface StorageAuditChartPoint {
  /** ISO hour bucket, e.g. "2026-03-20T05" */
  bucket: string;
  deposits: number;
  withdrawals: number;
  net: number;
  /** Cumulative net at the END of this bucket (open + net) */
  cumOpen: number;
  cumClose: number;
}

export interface StorageAuditResponse {
  logs: StorageAuditLogRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  chartData: StorageAuditChartPoint[];
  players: Array<{ entityId: string; name: string }>;
  items: Array<{ id: number; type: string; name: string }>;
}

export interface StorageAuditIngestResponse {
  ingested: boolean;
  moreRemaining: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const LOG_PAGE_SIZE = 1000;
/** Max buildings to fetch per request to limit latency */
const MAX_BUILDINGS_PER_REQUEST = 5;
/** Max total pages fetched across all buildings per request */
const MAX_PAGES_PER_REQUEST = 5;
/** Don't re-check a building if it was checked less than 60s ago */
const BUILDING_COOLDOWN_MS = 60_000;

// ─── Ingestion ──────────────────────────────────────────────────────────────────

/** Resolve an item name from BitJita metadata or gamedata fallback */
function resolveItemName(
  itemType: string,
  itemId: number,
  apiItems: Map<string, ItemMeta>,
): string {
  const meta = apiItems.get(String(itemId));
  if (meta?.name) return meta.name;
  const normalType = itemType === "cargo" ? "Cargo" : "Item";
  if (normalType === "Item")
    return gd.items.get(itemId)?.name ?? `Item #${itemId}`;
  return gd.cargo.get(itemId)?.name ?? `Cargo #${itemId}`;
}

/**
 * Get buildings with storage for a claim.
 * Filters to buildings that have storage_slots > 0 or cargo_slots > 0.
 */
async function getStorageBuildings(
  jita: BitJitaClient,
  claimId: string,
): Promise<BuildingInfo[]> {
  const resp = await jita.getClaimBuildings(claimId);
  const buildings = (
    Array.isArray(resp) ? resp : ((resp as any).buildings ?? resp)
  ) as BuildingInfo[];
  return buildings.filter((b) =>
    (b.functions ?? []).some(
      (f) => (f.storage_slots ?? 0) > 0 || (f.cargo_slots ?? 0) > 0,
    ),
  );
}

/**
 * Ingest new storage logs from BitJita into D1.
 * Picks buildings that haven't been checked recently and fetches new logs.
 * Returns true if there are still buildings that need checking.
 */
export async function ingestLogs(
  jita: BitJitaClient,
  db: D1Database,
  claimId: string,
): Promise<boolean> {
  // 1. Get storage buildings for this claim
  const buildings = await getStorageBuildings(jita, claimId);
  if (buildings.length === 0) return false;

  // 2. Ensure all buildings have fetch state entries (batch insert)
  const stateStmts = buildings.map((b) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO storage_fetch_state (claim_id, building_entity_id, newest_log_id, updated_at)
         VALUES (?, ?, NULL, NULL)`,
      )
      .bind(claimId, b.entityId),
  );

  // D1 batch limit is 100, so chunk if needed
  for (let i = 0; i < stateStmts.length; i += 100) {
    await db.batch(stateStmts.slice(i, i + 100));
  }

  // 3. Find buildings that need checking (oldest updated_at, or never checked)
  const cutoff = new Date(Date.now() - BUILDING_COOLDOWN_MS).toISOString();
  const staleBuildings = await db
    .prepare(
      `SELECT building_entity_id, newest_log_id
       FROM storage_fetch_state
       WHERE claim_id = ? AND (updated_at IS NULL OR updated_at < ?)
       ORDER BY updated_at ASC NULLS FIRST
       LIMIT ?`,
    )
    .bind(claimId, cutoff, MAX_BUILDINGS_PER_REQUEST)
    .all<{ building_entity_id: string; newest_log_id: string | null }>();

  if (!staleBuildings.results || staleBuildings.results.length === 0) {
    return false;
  }

  // 4. Fetch logs for each stale building
  let totalPagesFetched = 0;
  const buildingNameMap = new Map(
    buildings.map((b) => [b.entityId, b.buildingName ?? "Unknown"]),
  );

  for (const state of staleBuildings.results) {
    if (totalPagesFetched >= MAX_PAGES_PER_REQUEST) break;

    const buildingId = state.building_entity_id;
    const newestLogId = state.newest_log_id;
    const allNewLogs: StorageLogEntry[] = [];
    const itemMetaMap = new Map<string, ItemMeta>();
    let pageAfterId: string | undefined;
    let reachedCursor = false;

    // Paginate newest-to-oldest, stop when we hit the cursor
    while (!reachedCursor && totalPagesFetched < MAX_PAGES_PER_REQUEST) {
      totalPagesFetched++;

      const params: {
        buildingEntityId: string;
        limit: number;
        afterId?: string;
      } = { buildingEntityId: buildingId, limit: LOG_PAGE_SIZE };
      if (pageAfterId) params.afterId = pageAfterId;

      const resp = await jita.getLogsStorage(params);
      const logs = resp.logs as StorageLogEntry[];

      // Collect item metadata
      for (const item of (resp.items ?? []) as ItemMeta[]) {
        itemMetaMap.set(String(item.id), item);
      }
      for (const cargo of (resp.cargos ?? []) as ItemMeta[]) {
        itemMetaMap.set(String(cargo.id), cargo);
      }

      if (logs.length === 0) break;

      for (const log of logs) {
        if (newestLogId && log.id === newestLogId) {
          reachedCursor = true;
          break;
        }
        allNewLogs.push(log);
      }

      pageAfterId = logs[logs.length - 1]!.id;
      if (logs.length < LOG_PAGE_SIZE) break;
    }

    // 5. Insert new logs into D1
    if (allNewLogs.length > 0) {
      // D1 batch limit is 100 statements, so chunk
      const BATCH_SIZE = 50;
      for (let i = 0; i < allNewLogs.length; i += BATCH_SIZE) {
        const chunk = allNewLogs.slice(i, i + BATCH_SIZE);
        const insertStmts = chunk.map((log) => {
          const itemType = log.data.item_type === "cargo" ? "Cargo" : "Item";
          const action = log.data.type.startsWith("deposit")
            ? "deposit"
            : "withdraw";
          const itemName = resolveItemName(
            log.data.item_type,
            log.data.item_id,
            itemMetaMap,
          );
          const buildingName =
            log.building?.buildingName ??
            buildingNameMap.get(buildingId) ??
            "Unknown";

          return db
            .prepare(
              `INSERT OR IGNORE INTO storage_logs
               (id, claim_id, player_entity_id, player_name, building_entity_id, building_name,
                item_type, item_id, item_name, quantity, action, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              log.id,
              claimId,
              log.subjectEntityId,
              log.subjectName,
              buildingId,
              buildingName,
              itemType,
              log.data.item_id,
              itemName,
              log.data.quantity,
              action,
              // Strip timezone offset (+00) so SQLite STRFTIME works
              log.timestamp.replace(/\+\d{2}$/, ""),
            );
        });
        await db.batch(insertStmts);
      }
    }

    // 6. Update fetch state
    const newNewestId = allNewLogs.length > 0 ? allNewLogs[0]!.id : newestLogId;
    await db
      .prepare(
        `UPDATE storage_fetch_state
         SET newest_log_id = COALESCE(?, newest_log_id),
             updated_at = datetime('now')
         WHERE claim_id = ? AND building_entity_id = ?`,
      )
      .bind(newNewestId, claimId, buildingId)
      .run();
  }

  // Check if there are still stale buildings
  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM storage_fetch_state
       WHERE claim_id = ? AND (updated_at IS NULL OR updated_at < ?)`,
    )
    .bind(claimId, new Date().toISOString())
    .first<{ cnt: number }>();

  return (remaining?.cnt ?? 0) > 0;
}

// ─── Query ──────────────────────────────────────────────────────────────────────

export async function queryStorageAudit(
  db: D1Database,
  claimId: string,
  filters: {
    playerEntityId?: string;
    itemId?: number;
    itemType?: string;
    page: number;
    pageSize: number;
  },
): Promise<StorageAuditResponse> {
  // Build WHERE clause
  const conditions: string[] = ["claim_id = ?"];
  const params: (string | number)[] = [claimId];

  if (filters.playerEntityId) {
    conditions.push("player_entity_id = ?");
    params.push(filters.playerEntityId);
  }
  if (filters.itemId != null && filters.itemType) {
    conditions.push("item_id = ? AND item_type = ?");
    params.push(filters.itemId, filters.itemType);
  }

  const whereClause = conditions.join(" AND ");

  // Count total
  const countResult = await db
    .prepare(`SELECT COUNT(*) as cnt FROM storage_logs WHERE ${whereClause}`)
    .bind(...params)
    .first<{ cnt: number }>();
  const totalCount = countResult?.cnt ?? 0;

  // Paginated logs
  const offset = (filters.page - 1) * filters.pageSize;
  const logsResult = await db
    .prepare(
      `SELECT id, player_entity_id, player_name, building_name, item_type, item_id,
              item_name, quantity, action, timestamp
       FROM storage_logs
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<StorageAuditLogRow>();

  // Chart data: hourly aggregates
  const chartResult = await db
    .prepare(
      `SELECT
         STRFTIME('%Y-%m-%dT%H', timestamp) as bucket,
         SUM(CASE WHEN action = 'deposit' THEN quantity ELSE 0 END) as deposits,
         SUM(CASE WHEN action = 'withdraw' THEN quantity ELSE 0 END) as withdrawals
       FROM storage_logs
       WHERE ${whereClause}
       GROUP BY STRFTIME('%Y-%m-%dT%H', timestamp)
       ORDER BY bucket ASC`,
    )
    .bind(...params)
    .all<{ bucket: string; deposits: number; withdrawals: number }>();

  let cumulative = 0;
  const chartData: StorageAuditChartPoint[] = (chartResult.results ?? []).map(
    (row) => {
      const net = row.deposits - row.withdrawals;
      const cumOpen = cumulative;
      cumulative += net;
      return {
        bucket: row.bucket,
        deposits: row.deposits,
        withdrawals: row.withdrawals,
        net,
        cumOpen,
        cumClose: cumulative,
      };
    },
  );

  // Distinct players for filter dropdown
  const playersResult = await db
    .prepare(
      `SELECT DISTINCT player_entity_id as entityId, player_name as name
       FROM storage_logs
       WHERE claim_id = ?
       ORDER BY name ASC`,
    )
    .bind(claimId)
    .all<{ entityId: string; name: string }>();

  // Distinct items for filter dropdown
  const itemsResult = await db
    .prepare(
      `SELECT DISTINCT item_id as id, item_type as type, item_name as name
       FROM storage_logs
       WHERE claim_id = ?
       ORDER BY name ASC`,
    )
    .bind(claimId)
    .all<{ id: number; type: string; name: string }>();

  return {
    logs: logsResult.results ?? [],
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
    chartData,
    players: playersResult.results ?? [],
    items: itemsResult.results ?? [],
  };
}
