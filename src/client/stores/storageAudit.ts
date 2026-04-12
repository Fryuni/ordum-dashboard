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
import { persistentAtom } from "@nanostores/persistent";
import { atom, computed, onMount } from "nanostores";
import { useCapitalAsDefaultArray } from "./craftSource";
import { convexAction } from "../convex";
import { convexSub } from "./convexSub";
import { api } from "../../../convex/_generated/api";
import { computedAsync } from "@nanostores/async";

// ─── Types (matching the Convex query response) ────────────────────────────

export interface StorageAuditLogRow {
  id: string;
  claim_id: string;
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

// ─── JSON persistent atom helper ────────────────────────────────────────────

function persistentJsonAtom<T>(key: string, defaultValue: T) {
  return persistentAtom<T>(key, defaultValue, {
    encode: JSON.stringify,
    decode: (s) => {
      try {
        return JSON.parse(s);
      } catch {
        return defaultValue;
      }
    },
  });
}

// ─── Filter Atoms ───────────────────────────────────────────────────────────

export const $auditClaims = persistentJsonAtom<string[]>("auditClaims", []);
useCapitalAsDefaultArray($auditClaims);

/** Selected player entity IDs (empty array = all players) */
export const $auditPlayers = persistentJsonAtom<string[]>("auditPlayers", []);

/** Selected item keys as "Type:id" (empty array = all items) */
export const $auditItems = persistentJsonAtom<string[]>("auditItems", []);

/** Date range filter — ISO date strings like "2026-03-15" (empty = no bound) */
export const $auditDateFrom = persistentAtom<string>("auditDateFrom", "");
export const $auditDateTo = persistentAtom<string>("auditDateTo", "");

export const $auditPage = atom(1);

export const PAGE_SIZE = 50;

// Reset page to 1 when any filter changes
onMount($auditPage, () => {
  const unsubs = [
    $auditClaims,
    $auditPlayers,
    $auditItems,
    $auditDateFrom,
    $auditDateTo,
  ].map((store) => store.listen(() => $auditPage.set(1)));
  return () => unsubs.forEach((u) => u());
});

// ─── Data Store (real-time Convex subscription) ─────────────────────────────

export const $auditPageData = convexSub(
  [
    $auditClaims,
    $auditPlayers,
    $auditItems,
    $auditPage,
    $auditDateFrom,
    $auditDateTo,
  ],
  api.storageAudit.queryAudit,
  (claims, players, items, page, dateFrom, dateTo) => {
    if (!claims || claims.length === 0) return null;
    return {
      claimIds: claims,
      playerEntityIds: players.length > 0 ? players : undefined,
      itemKeys: items.length > 0 ? items : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    };
  },
);

export const $auditChartData = convexSub(
  [$auditClaims, $auditPlayers, $auditItems, $auditDateFrom, $auditDateTo],
  api.storageAudit.auditChart,
  (claims, players, items, dateFrom, dateTo) => {
    if (!claims || claims.length === 0) return null;
    return {
      claimIds: claims,
      playerEntityIds: players.length > 0 ? players : undefined,
      itemKeys: items.length > 0 ? items : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    };
  },
);

// ─── On-demand Sync ─────────────────────────────────────────────────────────

export const $syncing = atom(false);

/**
 * Trigger an on-demand ingestion via Convex action.
 * The subscription will auto-update when new data is written.
 */
export async function triggerSync() {
  if ($syncing.get()) return;
  $syncing.set(true);
  try {
    await convexAction(api.sync.triggerIngestion, {});
  } catch (e) {
    console.error("Sync error:", e);
  } finally {
    $syncing.set(false);
  }
}

// ─── Derived ────────────────────────────────────────────────────────────────

export const $auditTotalPages = computedAsync($auditPageData, (state) => {
  return Math.ceil(state.totalCount / PAGE_SIZE);
});

/** Combined view state to minimize useStore calls in the component. */
export const $auditView = computedAsync(
  [$auditPageData, $auditChartData, $auditPage, $auditTotalPages],
  (pageData, chartData, page, totalPages) => ({
    pageData,
    chartData,
    page,
    totalPages,
  }),
);
