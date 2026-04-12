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
import { atom, onMount } from "nanostores";
import { useCapitalAsDefaultArray } from "./craftSource";
import { convexAction } from "../convex";
import { convexSub } from "./convexSub";
import { api } from "../../../convex/_generated/api";
import { computedAsync } from "@nanostores/async";
import { itemIndex } from "../../common/itemIndex";

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

export interface StorageAuditPageResponse {
  page: StorageAuditLogRow[];
  isDone: boolean;
  continueCursor: string;
}

export interface StorageAuditFilterOptions {
  players: Array<{ entityId: string; name: string }>;
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

// ─── Cursor-based Pagination State ──────────────────────────────────────────

export const PAGE_SIZE = 50;

/** Current page cursor (null = first page). */
export const $auditCursor = atom<string | null>(null);

/** Stack of previous cursors for back-navigation. */
export const $auditCursorStack = atom<(string | null)[]>([]);

// Reset cursor when any filter changes
onMount($auditCursor, () => {
  const unsubs = [
    $auditClaims,
    $auditPlayers,
    $auditItems,
    $auditDateFrom,
    $auditDateTo,
  ].map((store) =>
    store.listen(() => {
      $auditCursor.set(null);
      $auditCursorStack.set([]);
    }),
  );
  return () => unsubs.forEach((u) => u());
});

// ─── Navigation ─────────────────────────────────────────────────────────────

export function goToNextPage(continueCursor: string) {
  $auditCursorStack.set([...$auditCursorStack.get(), $auditCursor.get()]);
  $auditCursor.set(continueCursor);
}

export function goToPrevPage() {
  const stack = $auditCursorStack.get();
  if (stack.length === 0) return;
  $auditCursor.set(stack[stack.length - 1]!);
  $auditCursorStack.set(stack.slice(0, -1));
}

export function goToFirstPage() {
  $auditCursor.set(null);
  $auditCursorStack.set([]);
}

// ─── Data Stores (real-time Convex subscriptions) ─────────────────────────

export const $auditPageData = convexSub(
  [
    $auditClaims,
    $auditPlayers,
    $auditItems,
    $auditCursor,
    $auditDateFrom,
    $auditDateTo,
  ],
  api.storageAudit.queryAuditPage,
  (claims, players, items, cursor, dateFrom, dateTo) => {
    if (!claims || claims.length === 0) return null;
    return {
      claimIds: claims,
      playerEntityIds: players.length > 0 ? players : undefined,
      itemKeys: items.length > 0 ? items : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      paginationOpts: {
        numItems: PAGE_SIZE,
        cursor,
      },
    };
  },
);

export const $auditFilterOptions = convexSub(
  [$auditClaims],
  api.storageAudit.queryAuditFilterOptions,
  (claims) => {
    if (!claims || claims.length === 0) return null;
    return { claimIds: claims };
  },
);

/** All game items for the item filter dropdown (static client-side data). */
export const auditItemOptions = itemIndex
  .map((item) => ({
    id: item.item_id,
    type: item.item_type,
    name: item.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

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

/** Combined view state to minimize useStore calls in the component. */
export const $auditView = computedAsync(
  [$auditPageData, $auditChartData, $auditFilterOptions],
  (pageData, chartData, filterOptions) => ({
    pageData,
    chartData,
    filterOptions,
  }),
);
