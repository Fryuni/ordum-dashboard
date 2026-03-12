/**
 * Settlement Planner
 *
 * Determines which researches are needed for the next settlement tier,
 * what items they require, and compares against current claim storage.
 */

import type { GameData, GameClaimTech, GameItemStack } from "./gamedata";
import { getItemName, getItemInfo } from "./gamedata";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ResearchRequirement {
  tech: GameClaimTech;
  items: {
    item_id: number;
    item_type: "Item" | "Cargo";
    name: string;
    tier: number;
    tag: string;
    icon: string;
    quantity_required: number;
    quantity_available: number;
    fulfilled: boolean;
  }[];
  supplies_cost: number;
  prerequisite_names: string[];
  already_researched: boolean;
}

export interface TierPlan {
  tier: number;
  tier_upgrade: ResearchRequirement | null;
  researches: ResearchRequirement[];
  total_supplies_needed: number;
  supplies_available: number;
  all_items_needed: {
    item_id: number;
    item_type: "Item" | "Cargo";
    name: string;
    tier: number;
    tag: string;
    icon: string;
    total_required: number;
    total_available: number;
    deficit: number;
  }[];
}

// ─── Main Function ─────────────────────────────────────────────────────────────

/**
 * Build the settlement upgrade plan.
 *
 * @param gd         Loaded game data
 * @param currentTier Current claim tier (e.g. 4)
 * @param learnedIds  Set of already-researched tech IDs
 * @param supplies    Current supplies count
 * @param inventory   Map of "Item:id" or "Cargo:id" → quantity available in buildings
 */
export function buildSettlementPlan(
  gd: GameData,
  currentTier: number,
  learnedIds: Set<number>,
  supplies: number,
  inventory: Map<string, number>,
): TierPlan[] {
  const plans: TierPlan[] = [];

  // Build plans for all tiers 1-10
  for (let tier = 1; tier <= 10; tier++) {
    const tierTechs = gd.claimTechs.filter(
      (t) => t.tier === tier && t.input.length > 0,
    );

    // Find the TierUpgrade entry
    const tierUpgradeTech = tierTechs.find(
      (t) => t.tech_type === "TierUpgrade",
    );
    const otherTechs = tierTechs.filter((t) => t.tech_type !== "TierUpgrade");

    const buildReq = (tech: GameClaimTech): ResearchRequirement => {
      const items = tech.input.map((inp) => {
        const info = getItemInfo(inp.item_type, inp.item_id);
        const key = `${inp.item_type}:${inp.item_id}`;
        const available = inventory.get(key) ?? 0;
        return {
          item_id: inp.item_id,
          item_type: inp.item_type,
          name: info.name,
          tier: info.tier,
          tag: info.tag,
          icon: info.icon,
          quantity_required: inp.quantity,
          quantity_available: available,
          fulfilled: available >= inp.quantity,
        };
      });

      const prereqNames = tech.requirements
        .map((rid) => gd.claimTechById.get(rid)?.name ?? `#${rid}`)
        .filter(Boolean);

      return {
        tech,
        items,
        supplies_cost: tech.supplies_cost,
        prerequisite_names: prereqNames,
        already_researched: learnedIds.has(tech.id),
      };
    };

    const tierUpgrade = tierUpgradeTech ? buildReq(tierUpgradeTech) : null;
    // For tiers already achieved, skip detailed research listing
    const researches = tier <= currentTier
      ? []
      : otherTechs.map(buildReq).sort((a, b) => {
          if (a.already_researched !== b.already_researched)
            return a.already_researched ? 1 : -1;
          return a.tech.name.localeCompare(b.tech.name);
        });

    // Only aggregate items from the TierUpgrade research (not all researches)
    const itemTotals = new Map<
      string,
      { item_id: number; item_type: "Item" | "Cargo"; total_required: number }
    >();
    if (tierUpgrade && !tierUpgrade.already_researched) {
      for (const item of tierUpgrade.items) {
        const key = `${item.item_type}:${item.item_id}`;
        const existing = itemTotals.get(key);
        if (existing) {
          existing.total_required += item.quantity_required;
        } else {
          itemTotals.set(key, {
            item_id: item.item_id,
            item_type: item.item_type,
            total_required: item.quantity_required,
          });
        }
      }
    }

    const allItemsNeeded = [...itemTotals.entries()]
      .map(([key, val]) => {
        const info = getItemInfo(val.item_type, val.item_id);
        const available = inventory.get(key) ?? 0;
        return {
          item_id: val.item_id,
          item_type: val.item_type,
          name: info.name,
          tier: info.tier,
          tag: info.tag,
          icon: info.icon,
          total_required: val.total_required,
          total_available: available,
          deficit: Math.max(0, val.total_required - available),
        };
      })
      // Sort by tier first, then by deficit
      .sort((a, b) => a.tier - b.tier || b.deficit - a.deficit);

    const totalSuppliesNeeded = tierUpgrade && !tierUpgrade.already_researched
      ? tierUpgrade.supplies_cost
      : 0;

    plans.push({
      tier,
      tier_upgrade: tierUpgrade,
      researches,
      total_supplies_needed: totalSuppliesNeeded,
      supplies_available: supplies,
      all_items_needed: allItemsNeeded,
    });
  }

  return plans;
}
