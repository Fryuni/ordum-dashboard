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
import { atom, computed } from "nanostores";
import { computedAsync } from "@nanostores/async";
import { $updateTimer } from "../util-store";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface WarClaimInfo {
  entityId: string;
  name: string;
  regionName: string;
  tier: number | null;
  supplies: number;
  treasury: number;
  numTiles: number;
  memberCount: number;
  empireName: string | null;
  isEmpire: boolean;
}

export interface WarData {
  empireClaims: WarClaimInfo[];
  trackedClaims: WarClaimInfo[];
  fetchedAt: string;
}

export interface ClaimSearchResult {
  entityId: string;
  name: string;
  regionName: string;
  tier: number | null;
  empireName: string | null;
}

// ─── Tracked Claims ─────────────────────────────────────────────────────────────

/** Persisted list of tracked enemy claim IDs */
export const $trackedClaimIds = persistentAtom<string>(
  "warTrackedClaims",
  "[]",
);

export const $trackedClaimIdList = computed($trackedClaimIds, (raw) => {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
});

export function addTrackedClaim(claimId: string) {
  const current = $trackedClaimIdList.get();
  if (!current.includes(claimId)) {
    $trackedClaimIds.set(JSON.stringify([...current, claimId]));
  }
}

export function removeTrackedClaim(claimId: string) {
  const current = $trackedClaimIdList.get();
  $trackedClaimIds.set(JSON.stringify(current.filter((id) => id !== claimId)));
}

// ─── Search ─────────────────────────────────────────────────────────────────────

export const $claimSearchQuery = atom("");
export const $claimSearchLoading = atom(false);
export const $claimSearchResults = atom<ClaimSearchResult[]>([]);

export async function searchClaims(query: string) {
  if (query.trim().length < 2) {
    $claimSearchResults.set([]);
    return;
  }
  $claimSearchLoading.set(true);
  try {
    const res = await fetch(
      `/api/war/search?q=${encodeURIComponent(query.trim())}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { claims: ClaimSearchResult[] } = await res.json();
    $claimSearchResults.set(data.claims);
  } catch (e) {
    console.error("Failed to search claims:", e);
    $claimSearchResults.set([]);
  } finally {
    $claimSearchLoading.set(false);
  }
}

// ─── War Data ───────────────────────────────────────────────────────────────────

export const $warData = computedAsync(
  [$trackedClaimIdList, $updateTimer],
  async (trackedIds: string[]) => {
    const params = new URLSearchParams();
    for (const id of trackedIds) {
      params.append("track", id);
    }
    const res = await fetch(`/api/war?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as WarData;
  },
);
