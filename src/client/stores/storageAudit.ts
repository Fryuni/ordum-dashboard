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
import { atom, computed, computedAsync, effect, onMount } from "nanostores";
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
  interactive: boolean,
): string {
  const params = new URLSearchParams({
    claim: claimId,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (interactive) params.set("interactive", "true");
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

async function fetchAuditData(
  url: string,
): Promise<StorageAuditResponse> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<StorageAuditResponse>;
}

// ─── Data Store (interactive — DB only, fast) ───────────────────────────────────

/**
 * Bumped after a background ingestion completes to make the interactive
 * query re-read fresh data from D1.
 */
const $refreshTick = atom(0);

export const $auditData = computedAsync(
  [$auditClaim, $auditPlayer, $auditItem, $auditPage, $refreshTick],
  async (
    claimId,
    player,
    item,
    page,
  ): Promise<StorageAuditResponse | null> => {
    if (!claimId) return null;
    const url = buildAuditUrl(claimId, player, item, page, true);
    return fetchAuditData(url);
  },
);

// ─── Background Ingestion ───────────────────────────────────────────────────────

/**
 * Runs a non-interactive request in the background to trigger BitJita
 * ingestion. When it completes, bumps $refreshTick so the interactive
 * query re-reads the now-updated D1 data.
 *
 * Polls every 5 s while the server reports ingesting: true.
 */
const $ingesting = atom(false);
export { $ingesting as $auditIngesting };

let ingestAbort: AbortController | null = null;

async function triggerIngestion(claimId: string) {
  // Abort any in-flight ingestion request
  ingestAbort?.abort();
  ingestAbort = new AbortController();

  try {
    // Minimal request — page 1, pageSize 1, just to trigger ingestion
    const url = buildAuditUrl(claimId, "", "", 1, false);
    const resp = await fetch(url, { signal: ingestAbort.signal });
    if (!resp.ok) return;
    const data: StorageAuditResponse = await resp.json();
    $ingesting.set(data.ingesting);
    // Bump tick so the interactive store re-fetches with fresh D1 data
    $refreshTick.set($refreshTick.get() + 1);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    console.error("Ingestion trigger error:", e);
  }
}

onMount($ingesting, () => {
  // Kick off initial ingestion when the claim is set
  const unsubClaim = $auditClaim.subscribe((claimId) => {
    if (claimId) triggerIngestion(claimId);
  });

  // Poll while ingesting
  const unsubPoll = effect($ingesting, (ingesting) => {
    if (!ingesting) return;
    const timer = setTimeout(() => {
      const claimId = $auditClaim.get();
      if (claimId) triggerIngestion(claimId);
    }, 5000);
    return () => clearTimeout(timer);
  });

  return () => {
    unsubClaim();
    unsubPoll();
    ingestAbort?.abort();
  };
});

// ─── Derived ────────────────────────────────────────────────────────────────────

export const $auditTotalPages = computed($auditData, (state) => {
  if (state.state !== "loaded" || !state.value) return 0;
  return Math.ceil(state.value.totalCount / PAGE_SIZE);
});
