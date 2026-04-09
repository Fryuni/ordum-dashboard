/**
 * Settlement data — Convex action that calls BitJita API.
 * Migrated from /api/settlement route.
 *
 * Note: Settlement planning uses game data (imported at bundle time).
 * The buildSettlementPlan and buildClaimInventory functions are imported
 * from common code.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import * as jita from "./lib/bitjita";
export const getSettlement = action({
  args: {
    claimId: v.string(),
  },
  handler: async (_ctx, args) => {
    const { claim } = await jita.getClaim(args.claimId);
    const currentTier = claim.tier ?? 1;
    const supplies = Number(claim.supplies) || 0;
    const learnedIds = new Set(
      (claim.researchedTechs ?? []).map((t) => Number(t.id)),
    );
    const claimName = claim.name ?? "Unknown Claim";
    // Build claim inventory from API
    const claimInv = await jita.getClaimInventories(args.claimId);
    const inventory = new Map();
    for (const building of claimInv.buildings ?? []) {
      for (const pocket of building.inventory ?? []) {
        if (!pocket.contents) continue;
        const c = pocket.contents;
        const itemType = c.item_type === "cargo" ? "Cargo" : "Item";
        const key = `${itemType}:${c.item_id}`;
        inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 0));
      }
    }
    // NOTE: buildSettlementPlan requires game data imports which are only
    // available in the client/worker bundle. We return the raw data and
    // let the client compute the plan (it already has the game data).
    return {
      currentTier,
      supplies,
      learnedCount: learnedIds.size,
      claimName,
      learnedIds: [...learnedIds],
      inventory: Object.fromEntries(inventory),
    };
  },
});
