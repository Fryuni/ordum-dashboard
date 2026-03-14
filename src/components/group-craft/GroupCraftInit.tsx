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
import { useEffect } from "preact/hooks";
import { $targets, type TargetItem } from "../../lib/stores/craft";
import { ORDUM_MAIN_CLAIM_ID } from "../../lib/ordum-data";
import { buildSettlementPlan } from "../../lib/settlement-planner";
import { api } from "../../lib/api";

/**
 * Invisible component that initializes group craft targets from props
 * (which come from URL query parameters parsed server-side).
 */
export default function GroupCraftInit() {
  useEffect(() => {
    setTimeout(async () => {
      // Check if we're coming from the settlement planner with pre-selected items
      const url = new URL(window.location.href);
      const fromSettlement = url.searchParams.get("from") === "settlement";
      const tier = parseInt(url.searchParams.get("tier") ?? "0");

      console.log("URL:", { fromSettlement, tier });

      if (fromSettlement && tier > 0) {
        try {
          const claim = await api.getClaim(ORDUM_MAIN_CLAIM_ID);
          const currentTier = claim.tier ?? 1;
          const learnedIds = new Set<number>(claim.learned_upgrades ?? []);
          const supplies = claim.supplies ?? 0;

          const plans = buildSettlementPlan(
            currentTier,
            learnedIds,
            supplies,
            new Map(),
          );
          const targetPlan = plans.find((p) => p.tier === tier);

          if (targetPlan) {
            let initialItems: TargetItem[] = [];
            for (const item of targetPlan.all_items_needed) {
              if (item.deficit > 0) {
                initialItems.push({
                  ...item,
                  name: item.name,
                  quantity: item.deficit,
                });
              }
            }
            $targets.set(initialItems);
          } else {
            console.log("No plan.");
          }
        } catch (e) {
          // Continue without pre-populated items
          console.error("Failed to build plan:", e);
        }
      }
    });
  }, []);

  return null;
}
