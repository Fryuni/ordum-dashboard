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
import { computedAsync } from "@nanostores/async";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { StorageAuditResponse } from "../../server/storage-audit";
import { $updateTimer } from "../util-store";

// ─── JSON persistent atom helper ────────────────────────────────────────────────

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

// ─── Filter Atoms ───────────────────────────────────────────────────────────────

export const $auditClaim = persistentAtom<string>(
  "auditClaim",
  ORDUM_MAIN_CLAIM_ID,
);

/** Selected player entity IDs (empty array = all players) */
export const $auditPlayers = persistentJsonAtom<string[]>("auditPlayers", []);

/** Selected item keys as "Type:id" (empty array = all items) */
export const $auditItems = persistentJsonAtom<string[]>("auditItems", []);

export const $auditPage = atom(1);

export const PAGE_SIZE = 50;

// Reset page to 1 when any filter changes
onMount($auditPage, () => {
  const unsubs = [$auditClaim, $auditPlayers, $auditItems].map((store) =>
    store.listen(() => $auditPage.set(1)),
  );
  return () => unsubs.forEach((u) => u());
});

// ─── Fetch Helper ───────────────────────────────────────────────────────────────

function buildAuditUrl(
  claimId: string,
  players: string[],
  items: string[],
  page: number,
): string {
  const params = new URLSearchParams({
    claim: claimId,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const p of players) params.append("player", p);
  for (const item of items) params.append("item", item);
  return `/api/storage-audit?${params}`;
}

// ─── Data Store ─────────────────────────────────────────────────────────────────

export const $auditData = computedAsync(
  [$auditClaim, $auditPlayers, $auditItems, $auditPage, $updateTimer],
  async (
    claimId,
    players,
    items,
    page,
  ): Promise<StorageAuditResponse | null> => {
    if (!claimId) return null;
    const url = buildAuditUrl(claimId, players, items, page);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json() as Promise<StorageAuditResponse>;
  },
);

// ─── On-demand Sync ─────────────────────────────────────────────────────────────

export const $syncing = atom(false);

/**
 * Trigger an on-demand ingestion. Calls the ingest endpoint, then
 * bumps $refreshTick so the query store re-fetches with fresh data.
 */
export async function triggerSync() {
  if ($syncing.get()) return;
  $syncing.set(true);
  try {
    const claimId = $auditClaim.get();
    const resp = await fetch(
      `/api/storage-audit/ingest?claim=${encodeURIComponent(claimId)}`,
      { method: "POST" },
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    $refreshTick.set($refreshTick.get() + 1);
  } catch (e) {
    console.error("Sync error:", e);
  } finally {
    $syncing.set(false);
  }
}

// ─── Derived ────────────────────────────────────────────────────────────────────

export const $auditTotalPages = computed($auditData, (state) => {
  if (state.state !== "ready" || !state.value) return 0;
  return Math.ceil(state.value.totalCount / PAGE_SIZE);
});

/** Combined view state to minimize useStore calls in the component. */
export const $auditView = computed(
  [$auditData, $auditPage, $auditTotalPages],
  (dataAsync, page, totalPages) => ({
    dataAsync,
    page,
    totalPages,
  }),
);
