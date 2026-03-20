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

// ─── Data Store ─────────────────────────────────────────────────────────────────

async function fetchAuditData(
  claimId: string,
  player: string,
  item: string,
  page: number,
): Promise<StorageAuditResponse> {
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

  const resp = await fetch(`/api/storage-audit?${params}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<StorageAuditResponse>;
}

/** Incremented to force a re-fetch (e.g. for ingestion polling). */
const $fetchTick = atom(0);

export const $auditData = computedAsync(
  [$auditClaim, $auditPlayer, $auditItem, $auditPage, $fetchTick],
  async (
    claimId,
    player,
    item,
    page,
  ): Promise<StorageAuditResponse | null> => {
    if (!claimId) return null;
    return fetchAuditData(claimId, player, item, page);
  },
);

// ─── Ingestion Polling ──────────────────────────────────────────────────────────

/**
 * When the server reports `ingesting: true`, automatically re-fetch every 5s
 * so the UI stays up to date as logs stream in.
 */
onMount($fetchTick, () =>
  effect($auditData, (state) => {
    if (state.state !== "loaded" || !state.value?.ingesting) return;

    const timer = setTimeout(() => {
      $fetchTick.set($fetchTick.get() + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }),
);

// ─── Derived ────────────────────────────────────────────────────────────────────

export const $auditTotalPages = computed($auditData, (state) => {
  if (state.state !== "loaded" || !state.value) return 0;
  return Math.ceil(state.value.totalCount / PAGE_SIZE);
});
