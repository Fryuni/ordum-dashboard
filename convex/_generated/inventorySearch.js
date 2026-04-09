/**
 * Inventory Search — Convex action that calls BitJita API.
 * Migrated from /api/inventory-search route.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import * as jita from "./lib/bitjita";
/** Building description IDs for bank buildings (personal storage) */
const BANK_BUILDING_IDS = new Set([
  985246037, // Town Bank
  1615467546, // Ancient Bank
  969744821, // Lost Items Chest
]);
export const search = action({
  args: {
    claimId: v.string(),
  },
  handler: async (_ctx, args) => {
    const [claimInv, { claim }] = await Promise.all([
      jita.getClaimInventories(args.claimId),
      jita.getClaim(args.claimId),
    ]);
    // Build item/cargo lookup dicts
    const itemsDict = {};
    for (const item of claimInv.items ?? []) {
      itemsDict[String(item.id)] = item;
    }
    const cargosDict = {};
    for (const cargo of claimInv.cargos ?? []) {
      cargosDict[String(cargo.id)] = cargo;
    }
    // Build inventory map (excluding bank buildings)
    const rawInventory = new Map();
    for (const building of claimInv.buildings ?? []) {
      if (BANK_BUILDING_IDS.has(building.buildingDescriptionId)) continue;
      const buildingLabel =
        building.buildingNickname ??
        building.buildingName ??
        "Unknown Building";
      for (const pocket of building.inventory ?? []) {
        if (!pocket.contents) continue;
        const c = pocket.contents;
        const isCargo = c.item_type === "cargo";
        const itemType = isCargo ? "Cargo" : "Item";
        const key = `${itemType}:${c.item_id}`;
        const qty = c.quantity ?? 0;
        if (qty <= 0) continue;
        const places = rawInventory.get(key) ?? [];
        const existing = places.find((p) => p.name === buildingLabel);
        if (existing) {
          existing.quantity += qty;
        } else {
          places.push({ name: buildingLabel, quantity: qty });
        }
        rawInventory.set(key, places);
      }
    }
    // Convert to array with metadata
    const items = [];
    for (const [key, places] of rawInventory) {
      const [type, idStr] = key.split(":");
      const id = Number(idStr);
      const isCargo = type === "Cargo";
      const desc = isCargo ? cargosDict[String(id)] : itemsDict[String(id)];
      const totalQuantity = places.reduce((sum, p) => sum + p.quantity, 0);
      if (totalQuantity <= 0) continue;
      items.push({
        key,
        name: desc?.name ?? `${type} #${id}`,
        tier: desc?.tier ?? 0,
        tag: desc?.tag ?? "",
        rarity: desc?.rarityStr ?? "",
        totalQuantity,
        locations: places,
      });
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return {
      items,
      claimName: claim.name ?? "Unknown Claim",
      regionName: claim.regionName ?? "Unknown Region",
      claimLocationX: claim.locationX ?? 0,
      claimLocationZ: claim.locationZ ?? 0,
    };
  },
});
