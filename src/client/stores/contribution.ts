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
import { computedAsync } from "@nanostores/async";
import { jita } from "../../common/api";
import { $updateTimer } from "../util-store";
import { useCapitalAsDefault } from "./craftSource";
import { convexAction } from "../convex";
import { api } from "../../../convex/_generated/api";

// ─── Types ──────────────────────────────────────────────────────────────────

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

export interface ContributionData {
  deposited: Record<string, number>;
  withdrawn: Record<string, number>;
  prices: Record<string, number>;
  items: Record<string, ContributionItemMeta>;
}

// ─── Selection Atoms ────────────────────────────────────────────────────────

export const $contributionClaim = persistentAtom<string>(
  "contributionClaim",
  "",
);
useCapitalAsDefault($contributionClaim);

export const $contributionPlayer = persistentAtom<string>(
  "contributionPlayer",
  "",
);

// ─── Derived Stores ─────────────────────────────────────────────────────────

/** Claim members for the selected contribution claim (still uses /jita proxy) */
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

/** Contribution data via Convex action */
export const $contributionData = computedAsync(
  [$contributionClaim, $contributionPlayer, $updateTimer],
  async (claimId, playerEntityId): Promise<ContributionData | null> => {
    if (!claimId || !playerEntityId) return null;
    return convexAction(api.contribution.getContribution, {
      claimId,
      playerEntityId,
    });
  },
);
