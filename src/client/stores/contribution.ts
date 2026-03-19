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
import { computedAsync } from "nanostores";
import { jita } from "../../common/api";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { ContributionResponse } from "../../server/contribution";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ContributionMember {
  entityId: string;
  playerEntityId: string;
  userName: string;
}

export interface ContributionItemMeta {
  id: number;
  name: string;
  iconAssetName: string;
  tier: number;
  rarityStr: string;
  tag: string;
}

export type ContributionData = ContributionResponse;

// ─── Selection Atoms ────────────────────────────────────────────────────────────

export const $contributionClaim = persistentAtom<string>(
  "contributionClaim",
  ORDUM_MAIN_CLAIM_ID,
);

export const $contributionPlayer = persistentAtom<string>(
  "contributionPlayer",
  "",
);

// ─── Derived Stores ─────────────────────────────────────────────────────────────

/** Claim members for the selected contribution claim. */
export const $claimMembers = computedAsync(
  $contributionClaim,
  async (claimId): Promise<ContributionMember[]> => {
    if (!claimId) return [];
    const resp = await jita.getClaimMembers(claimId);
    return (resp.members ?? [])
      .map((m) => ({
        entityId: m.entityId,
        playerEntityId: m.playerEntityId,
        userName: m.userName,
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName));
  },
);

/** Contribution data for the selected (claim, player) pair. */
export const $contributionData = computedAsync(
  [$contributionClaim, $contributionPlayer],
  async (claimId, playerEntityId): Promise<ContributionData | null> => {
    if (!claimId || !playerEntityId) return null;
    const params = new URLSearchParams({
      claim: claimId,
      player: playerEntityId,
    });
    const resp = await fetch(`/api/contribution?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json() as Promise<ContributionData>;
  },
);
