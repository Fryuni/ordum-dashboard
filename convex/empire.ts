/**
 * Empire data — Convex actions that call BitJita API.
 * Migrated from src/server/ordum-data.ts and /api/empire, /api/empire-claims routes.
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

// ─── Empire Claims ──────────────────────────────────────────────────────────

export const getEmpireClaims = action({
  args: {},
  handler: async () => {
    const { empire } = await jita.getEmpire(jita.ORDUM_EMPIRE_ID);
    if (!empire) throw new Error("Empire not found");

    const capitalBuildingEntityId: string | null =
      empire.capitalBuildingEntityId ?? null;

    const claimsData = await jita.getEmpireClaims(jita.ORDUM_EMPIRE_ID);
    const claims = (claimsData.claims as any[]).map((cl: any) => ({
      id: cl.entityId,
      name: cl.name,
    }));

    let capitalClaimId: string | null = null;
    if (capitalBuildingEntityId && claims.length > 0) {
      const details = await Promise.all(
        claims.map(async (cl) => {
          try {
            const { claim } = await jita.getClaim(cl.id);
            return {
              id: cl.id,
              ownerBuildingEntityId: claim.ownerBuildingEntityId,
            };
          } catch {
            return { id: cl.id, ownerBuildingEntityId: null };
          }
        }),
      );
      capitalClaimId =
        details.find((d) => d.ownerBuildingEntityId === capitalBuildingEntityId)
          ?.id ??
        claims[0]?.id ??
        null;
    } else if (claims.length > 0) {
      capitalClaimId = claims[0]?.id ?? null;
    }

    return { claims, capitalClaimId };
  },
});

// ─── Full Empire Data ───────────────────────────────────────────────────────

export const getEmpireData = action({
  args: {},
  handler: async () => {
    let hexiteReserve = 0;
    let capitalBuildingEntityId: string | null = null;
    let resolvedClaimIds: { id: string; name: string }[] = [];

    try {
      const { empire } = (await jita.getEmpire(jita.ORDUM_EMPIRE_ID)) as any;
      if (empire) {
        hexiteReserve =
          Number(empire.empireCurrencyTreasury) ||
          Number(empire.shardTreasury) ||
          0;
        capitalBuildingEntityId = empire.capitalBuildingEntityId ?? null;
        const claimsData = await jita.getEmpireClaims(jita.ORDUM_EMPIRE_ID);
        resolvedClaimIds = (claimsData.claims as any[]).map((cl: any) => ({
          id: cl.entityId,
          name: cl.name,
        }));
      }
    } catch (err) {
      console.error("Failed to discover empire claims:", err);
    }

    const claims: any[] = [];
    for (const { id } of resolvedClaimIds) {
      try {
        const claim = await fetchClaimData(id);
        claims.push(claim);
      } catch (err) {
        console.error(`Failed to fetch claim ${id}:`, err);
      }
    }

    // Aggregate totals
    let totalMembers = 0;
    let onlineMembers = 0;
    let totalBuildings = 0;
    let totalTiles = 0;
    const allBuildingRes: any[] = [];

    for (const claim of claims) {
      totalMembers += claim.member_count;
      onlineMembers += claim.members.filter((m: any) => m.online).length;
      totalBuildings += claim.building_count;
      totalTiles += claim.num_tiles;
      for (const r of claim.building_resources) {
        allBuildingRes.push(r);
      }
    }

    const mergedBuilding = mergeResources(allBuildingRes);

    return {
      claims,
      totals: {
        total_members: totalMembers,
        online_members: onlineMembers,
        total_buildings: totalBuildings,
        total_tiles: totalTiles,
        total_building_resource_types: mergedBuilding.length,
        total_building_resource_count: mergedBuilding.reduce(
          (s, r) => s + r.quantity,
          0,
        ),
        total_player_resource_types: 0,
        total_player_resource_count: 0,
        total_tool_types: 0,
        total_tool_count: 0,
      },
      hexite_reserve: hexiteReserve,
      capital_claim_entity_id:
        capitalBuildingEntityId !== null
          ? (claims.find(
              (c) =>
                c.owner_building_entity_id === capitalBuildingEntityId,
            )?.entity_id ?? null)
          : null,
      all_building_resources: mergedBuilding,
      all_player_resources: [],
      all_tool_resources: [],
      fetched_at: new Date().toISOString(),
    };
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function mergeResources(items: any[]): any[] {
  const map = new Map<string, any>();
  for (const item of items) {
    const key = `${item.item_type}:${item.item_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function parseBuildingInventories(
  buildings: any[],
  itemsDict: Record<string, any>,
  cargosDict: Record<string, any>,
): any[] {
  const byKey = new Map<string, any>();

  for (const building of buildings) {
    if (BANK_BUILDING_IDS.has(building.buildingDescriptionId)) continue;

    const buildingLabel =
      building.buildingNickname ?? building.buildingName ?? "Unknown Building";

    for (const pocket of building.inventory ?? []) {
      if (!pocket.contents) continue;
      const c = pocket.contents;
      const isCargo = c.item_type === "cargo";
      const itemType = isCargo ? "Cargo" : "Item";
      const key = `${itemType}:${c.item_id}`;
      const qty = c.quantity ?? 0;
      if (qty <= 0) continue;

      const desc = isCargo
        ? cargosDict[String(c.item_id)]
        : itemsDict[String(c.item_id)];

      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          item_id: c.item_id,
          name: desc?.name ?? `${itemType} #${c.item_id}`,
          description: "",
          icon_asset_name: desc?.iconAssetName ?? "",
          tier: desc?.tier ?? 0,
          tag: desc?.tag ?? "",
          rarity: desc?.rarityStr,
          item_type: itemType,
          quantity: 0,
          durability: null,
          locations: [],
        };
        byKey.set(key, entry);
      }

      entry.quantity += qty;
      const existingLoc = entry.locations.find(
        (l: any) => l.building_name === buildingLabel,
      );
      if (existingLoc) {
        existingLoc.quantity += qty;
      } else {
        entry.locations.push({
          owner_type: "Building",
          owner_name: buildingLabel,
          building_name: buildingLabel,
          building_description_id: building.buildingDescriptionId,
          quantity: qty,
          inventory_entity_id: Number(building.entityId) || 0,
        });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.quantity - a.quantity);
}

async function fetchClaimData(claimIdStr: string) {
  const [{ claim }, claimInv, claimMembers] = await Promise.all([
    jita.getClaim(claimIdStr),
    jita.getClaimInventories(claimIdStr),
    jita.getClaimMembers(claimIdStr),
  ]);

  const itemsDict: Record<string, any> = {};
  for (const item of claimInv.items ?? []) {
    itemsDict[String(item.id)] = item;
  }
  const cargosDict: Record<string, any> = {};
  for (const cargo of claimInv.cargos ?? []) {
    cargosDict[String(cargo.id)] = cargo;
  }

  const buildingResources = parseBuildingInventories(
    claimInv.buildings ?? [],
    itemsDict,
    cargosDict,
  );

  const rawMembers = (claimMembers.members ?? []).map((m: any) => ({
    entity_id: m.playerEntityId,
    user_name: m.userName,
    inventory_permission: m.inventoryPermission === 1,
    build_permission: m.buildPermission === 1,
    officer_permission: m.officerPermission === 1,
    co_owner_permission: m.coOwnerPermission === 1,
  }));

  const onlineStatuses = await Promise.all(
    rawMembers.map(async (m: any) => {
      try {
        const buffs = await jita.getPlayerBuffs(m.entity_id);
        return buffs.isOnline;
      } catch {
        return false;
      }
    }),
  );

  const members = rawMembers.map((m: any, i: number) => ({
    ...m,
    online: onlineStatuses[i] ?? false,
    skills: {},
    inventory_items: [],
    tool_items: [],
  }));

  return {
    entity_id: claim.entityId,
    owner_building_entity_id: claim.ownerBuildingEntityId,
    name: claim.name,
    region: claim.regionName,
    tier: claim.tier ?? null,
    supplies: Number(claim.supplies) || 0,
    treasury: Number(claim.treasury) || 0,
    num_tiles: claim.numTiles,
    member_count: members.length,
    building_count: (claimInv.buildings ?? []).length,
    building_resources: buildingResources,
    player_resources: [],
    player_offline_resources: [],
    tool_resources: [],
    tool_offline_resources: [],
    members: members.sort((a: any, b: any) =>
      a.online === b.online ? 0 : a.online ? -1 : 1,
    ),
  };
}
