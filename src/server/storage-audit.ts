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

import { sql, type ExpressionBuilder } from "kysely";
import type { Kysely } from "kysely";
import type BitJitaClient from "../common/bitjita-client";
import { gd } from "../common/gamedata";
import type { Database } from "./db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Shape of each storage log entry from the BitJita API. */
interface StorageLogEntry {
  id: string;
  objectEntityId: string;
  subjectEntityId: string;
  subjectName: string;
  subjectType: string;
  data: {
    type: string;
    item_id: number;
    quantity: number;
    item_type: string;
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
  unit_value: number;
  action: string;
  timestamp: string;
}

export interface StorageAuditChartPoint {
  bucket: string;
  deposits: number;
  withdrawals: number;
  net: number;
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
const MAX_BUILDINGS_PER_REQUEST = 5;
const MAX_PAGES_PER_REQUEST = 5;
const BUILDING_COOLDOWN_MS = 60_000;
const PRICE_BATCH_SIZE = 100;
/** D1 limits: 100 bound params per query. 13 columns → max 7 rows per INSERT. */
const INSERT_BATCH_SIZE = 7;

const FIXED_VALUE = new Map<string, number>([
  ["Item:1", 1], // Hex Coin
]);

const EXCLUDED_ITEMS = new Set<string>(["Cargo:2000000"]);

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

/** Fetch market prices for a set of items/cargo from BitJita. */
async function fetchItemPrices(
  jita: BitJitaClient,
  logs: StorageLogEntry[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const itemIds = new Set<number>();
  const cargoIds = new Set<number>();

  for (const log of logs) {
    const itemType = log.data.item_type === "cargo" ? "Cargo" : "Item";
    const key = `${itemType}:${log.data.item_id}`;
    if (FIXED_VALUE.has(key)) {
      prices.set(key, FIXED_VALUE.get(key)!);
    } else if (!EXCLUDED_ITEMS.has(key)) {
      if (itemType === "Cargo") cargoIds.add(log.data.item_id);
      else itemIds.add(log.data.item_id);
    }
  }

  const allItemIds = Array.from(itemIds);
  const allCargoIds = Array.from(cargoIds);
  let iIdx = 0;
  let cIdx = 0;

  while (iIdx < allItemIds.length || cIdx < allCargoIds.length) {
    const batchItems: number[] = [];
    const batchCargo: number[] = [];
    let remaining = PRICE_BATCH_SIZE;

    const itemsToTake = Math.min(allItemIds.length - iIdx, remaining);
    batchItems.push(...allItemIds.slice(iIdx, iIdx + itemsToTake));
    iIdx += itemsToTake;
    remaining -= itemsToTake;

    if (remaining > 0) {
      const cargoToTake = Math.min(allCargoIds.length - cIdx, remaining);
      batchCargo.push(...allCargoIds.slice(cIdx, cIdx + cargoToTake));
      cIdx += cargoToTake;
    }

    try {
      const priceData = await jita.postMarketPricesBulk({
        itemIds: batchItems.length > 0 ? batchItems : undefined,
        cargoIds: batchCargo.length > 0 ? batchCargo : undefined,
      });
      for (const [id, info] of Object.entries(priceData.data.items)) {
        const p = info as {
          highestBuyPrice?: number;
          lowestSellPrice?: number;
        };
        const buy = p.highestBuyPrice ?? 0;
        const sell = p.lowestSellPrice ?? 0;
        if (buy > 0 || sell > 0) prices.set(`Item:${id}`, (buy + sell) / 2);
      }
      for (const [id, info] of Object.entries(priceData.data.cargo)) {
        const p = info as {
          highestBuyPrice?: number;
          lowestSellPrice?: number;
        };
        const buy = p.highestBuyPrice ?? 0;
        const sell = p.lowestSellPrice ?? 0;
        if (buy > 0 || sell > 0) prices.set(`Cargo:${id}`, (buy + sell) / 2);
      }
    } catch (e) {
      console.error(
        `[storage-audit] Price fetch failed (items=${batchItems.length}, cargo=${batchCargo.length}):`,
        e,
      );
    }
  }

  console.log(
    `[storage-audit] Price lookup: ${prices.size} prices for ${allItemIds.length} items + ${allCargoIds.length} cargo`,
  );
  return prices;
}

// ─── Ingestion ──────────────────────────────────────────────────────────────────

export async function ingestLogs(
  jita: BitJitaClient,
  db: Kysely<Database>,
  claimId: string,
): Promise<boolean> {
  // 1. Get storage buildings for this claim
  const buildings = await getStorageBuildings(jita, claimId);
  if (buildings.length === 0) return false;

  // 2. Ensure all buildings have fetch state entries
  for (const b of buildings) {
    await db
      .insertInto("storage_fetch_state")
      .values({
        claim_id: claimId,
        building_entity_id: b.entityId,
        newest_log_id: null,
        updated_at: null,
      })
      .onConflict((oc) =>
        oc.columns(["claim_id", "building_entity_id"]).doNothing(),
      )
      .execute();
  }

  // 3. Find buildings that need checking
  const cutoff = new Date(Date.now() - BUILDING_COOLDOWN_MS).toISOString();
  const staleBuildings = await db
    .selectFrom("storage_fetch_state")
    .select(["building_entity_id", "newest_log_id"])
    .where("claim_id", "=", claimId)
    .where((eb: ExpressionBuilder<Database, "storage_fetch_state">) =>
      eb.or([
        eb("updated_at", "is", null),
        eb("updated_at", "<", cutoff),
      ]),
    )
    .orderBy(sql`updated_at ASC NULLS FIRST`)
    .limit(MAX_BUILDINGS_PER_REQUEST)
    .execute();

  if (staleBuildings.length === 0) return false;

  // 4. Fetch logs for each stale building
  let totalPagesFetched = 0;
  const buildingNameMap = new Map(
    buildings.map((b) => [b.entityId, b.buildingName ?? "Unknown"]),
  );

  for (const state of staleBuildings) {
    if (totalPagesFetched >= MAX_PAGES_PER_REQUEST) break;

    const buildingId = state.building_entity_id;
    const newestLogId = state.newest_log_id;
    const allNewLogs: StorageLogEntry[] = [];
    const itemMetaMap = new Map<string, ItemMeta>();
    let pageAfterId: string | undefined;
    let reachedCursor = false;

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

    // 5. Fetch market prices
    const itemPrices =
      allNewLogs.length > 0
        ? await fetchItemPrices(jita, allNewLogs)
        : new Map<string, number>();

    if (allNewLogs.length > 0) {
      const withPrice = allNewLogs.filter((log) => {
        const t = log.data.item_type === "cargo" ? "Cargo" : "Item";
        return (Number(itemPrices.get(`${t}:${log.data.item_id}`)) || 0) > 0;
      }).length;
      console.log(
        `[storage-audit] Building ${buildingId}: ${allNewLogs.length} logs, ${itemPrices.size} prices, ${withPrice} logs with value`,
      );
    }

    // 6. Insert new logs
    for (let i = 0; i < allNewLogs.length; i += INSERT_BATCH_SIZE) {
      const chunk = allNewLogs.slice(i, i + INSERT_BATCH_SIZE);
      const rows = chunk.map((log) => {
        const itemType = log.data.item_type === "cargo" ? "Cargo" : "Item";
        return {
          id: log.id,
          claim_id: claimId,
          player_entity_id: log.subjectEntityId,
          player_name: log.subjectName,
          building_entity_id: buildingId,
          building_name:
            log.building?.buildingName ??
            buildingNameMap.get(buildingId) ??
            "Unknown",
          item_type: itemType,
          item_id: log.data.item_id,
          item_name: resolveItemName(
            log.data.item_type,
            log.data.item_id,
            itemMetaMap,
          ),
          quantity: log.data.quantity,
          unit_value:
            Number(itemPrices.get(`${itemType}:${log.data.item_id}`)) || 0,
          action: log.data.type.startsWith("deposit") ? "deposit" : "withdraw",
          timestamp: log.timestamp.replace(/\+\d{2}$/, ""),
        };
      });

      await db
        .insertInto("storage_logs")
        .values(rows)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
    }

    // 7. Update fetch state
    const newNewestId =
      allNewLogs.length > 0 ? allNewLogs[0]!.id : newestLogId;
    await db
      .updateTable("storage_fetch_state")
      .set({
        newest_log_id: sql`COALESCE(${newNewestId}, newest_log_id)`,
        updated_at: sql`datetime('now')`,
      })
      .where("claim_id", "=", claimId)
      .where("building_entity_id", "=", buildingId)
      .execute();
  }

  // Check if there are still stale buildings
  const remaining = await db
    .selectFrom("storage_fetch_state")
    .select(sql<number>`COUNT(*)`.as("cnt"))
    .where("claim_id", "=", claimId)
    .where((eb: ExpressionBuilder<Database, "storage_fetch_state">) =>
      eb.or([
        eb("updated_at", "is", null),
        eb("updated_at", "<", new Date().toISOString()),
      ]),
    )
    .executeTakeFirstOrThrow();

  return remaining.cnt > 0;
}

// ─── Query ──────────────────────────────────────────────────────────────────────

export async function queryStorageAudit(
  db: Kysely<Database>,
  claimId: string,
  filters: {
    playerEntityIds?: string[];
    itemKeys?: string[];
    page: number;
    pageSize: number;
  },
): Promise<StorageAuditResponse> {
  // Build WHERE conditions as an expression
  function applyFilters<T extends ExpressionBuilder<Database, "storage_logs">>(eb: T): ReturnType<T["and"]> {
    const conditions: any[] = [eb("claim_id", "=", claimId)];

    if (filters.playerEntityIds && filters.playerEntityIds.length > 0) {
      conditions.push(eb("player_entity_id", "in", filters.playerEntityIds));
    }

    if (filters.itemKeys && filters.itemKeys.length > 0) {
      const parsed = filters.itemKeys
        .map((k) => k.split(":"))
        .filter((parts): parts is [string, string] => parts.length === 2);

      if (parsed.length > 0) {
        conditions.push(
          eb.or(
            parsed.map(([type, id]) =>
              eb.and([
                eb("item_type", "=", type),
                eb("item_id", "=", Number(id)),
              ]),
            ),
          ),
        );
      }
    }

    return eb.and(conditions) as any;
  }

  // Count total
  const countResult = await db
    .selectFrom("storage_logs")
    .select(sql<number>`COUNT(*)`.as("cnt"))
    .where(applyFilters)
    .executeTakeFirstOrThrow();
  const totalCount = countResult.cnt;

  // Paginated logs
  const offset = (filters.page - 1) * filters.pageSize;
  const logs = await db
    .selectFrom("storage_logs")
    .select([
      "id",
      "player_entity_id",
      "player_name",
      "building_name",
      "item_type",
      "item_id",
      "item_name",
      "quantity",
      "unit_value",
      "action",
      "timestamp",
    ])
    .where(applyFilters)
    .orderBy("timestamp", "desc")
    .limit(filters.pageSize)
    .offset(offset)
    .execute();

  // Chart data: hourly aggregates (value = quantity × unit_value)
  const chartRows = await db
    .selectFrom("storage_logs")
    .select([
      sql<string>`STRFTIME('%Y-%m-%dT%H', timestamp)`.as("bucket"),
      sql<number>`SUM(CASE WHEN action = 'deposit' THEN quantity * unit_value ELSE 0 END)`.as(
        "deposits",
      ),
      sql<number>`SUM(CASE WHEN action = 'withdraw' THEN quantity * unit_value ELSE 0 END)`.as(
        "withdrawals",
      ),
    ])
    .where(applyFilters)
    .groupBy(sql`STRFTIME('%Y-%m-%dT%H', timestamp)`)
    .orderBy("bucket", "asc")
    .execute();

  let cumulative = 0;
  const chartData: StorageAuditChartPoint[] = chartRows.map((row) => {
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
  });

  // Distinct players for filter dropdown
  const players = await db
    .selectFrom("storage_logs")
    .select([
      "player_entity_id as entityId",
      "player_name as name",
    ])
    .where("claim_id", "=", claimId)
    .distinct()
    .orderBy("player_name", "asc")
    .execute();

  // Distinct items for filter dropdown
  const items = await db
    .selectFrom("storage_logs")
    .select([
      "item_id as id",
      "item_type as type",
      "item_name as name",
    ])
    .where("claim_id", "=", claimId)
    .distinct()
    .orderBy("item_name", "asc")
    .execute();

  return {
    logs,
    totalCount,
    page: filters.page,
    pageSize: filters.pageSize,
    chartData,
    players,
    items,
  };
}
