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
import { atom, computed, computedAsync, onMount } from "nanostores";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { StorageAuditResponse } from "../../server/storage-audit";

// ─── Filter Atoms ───────────────────────────────────────────────────────────────

export const $auditClaim = persistentAtom<string>(
  "auditClaim",
  ORDUM_MAIN_CLAIM_ID,
);

export const $auditPlayer = persistentAtom<string>("auditPlayer", "");

export const $auditItem = persistentAtom<string>("auditItem", "");

export const $auditPage = atom(1);

export const PAGE_SIZE = 50;

// Reset page to 1 when any filter changes
onMount($auditPage, () => {
  const unsubs = [$auditClaim, $auditPlayer, $auditItem].map((store) =>
    store.listen(() => $auditPage.set(1)),
  );
  return () => unsubs.forEach((u) => u());
});

// ─── Fetch Helper ───────────────────────────────────────────────────────────────

function buildAuditUrl(
  claimId: string,
  player: string,
  item: string,
  page: number,
): string {
  const params = new URLSearchParams({
    claim: claimId,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (player) params.set("player", player);
  if (item) {
    const [type, id] = item.split(":");
    if (type && id) {
      params.set("itemType", type);
      params.set("itemId", id);
    }
  }
  return `/api/storage-audit?${params}`;
}

// ─── Data Store ─────────────────────────────────────────────────────────────────

/**
 * Bumped after an on-demand sync completes to refresh the query data.
 */
const $refreshTick = atom(0);

export const $auditData = computedAsync(
  [$auditClaim, $auditPlayer, $auditItem, $auditPage, $refreshTick],
  async (claimId, player, item, page): Promise<StorageAuditResponse | null> => {
    if (!claimId) return null;
    const url = buildAuditUrl(claimId, player, item, page);
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
  if (state.state !== "loaded" || !state.value) return 0;
  return Math.ceil(state.value.totalCount / PAGE_SIZE);
});

/** Combined view state to minimize useStore calls in the component. */
export const $auditView = computed(
  [$auditData, $auditPage, $auditTotalPages, $syncing],
  (dataAsync, page, totalPages, syncing) => ({
    dataAsync,
    page,
    totalPages,
    syncing,
  }),
);
