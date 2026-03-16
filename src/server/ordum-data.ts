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
/**
 * Ordum Empire Data Fetcher
 *
 * Fetches and aggregates resource data across all claims in the Ordum empire.
 * Uses the BitJita API to pull claim details including:
 *  - Building inventories (resources stored in claim buildings)
 *  - Member details
 */

import type {
  JitaClaimBuildingInventory,
  JitaClaimMember,
} from "../common/bitjita-client";
import { serverJita as api } from "./api-server";
import { BANK_BUILDING_IDS } from "../common/claim-inventory";

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Ordum City — the main claim and empire leader */
export const ORDUM_MAIN_CLAIM_ID = "1224979098661645606";

/**
 * All claims in the Ordum empire. The user can update this list as the empire
 * grows. The first entry is the leader claim (Ordum City).
 * To discover claim IDs: use the /claims?search=NAME endpoint.
 *
 * NOTE: IDs are strings because they exceed Number.MAX_SAFE_INTEGER.
 */
export const EMPIRE_CLAIM_IDS: { id: string; name: string }[] = [
  { id: "1224979098661645606", name: "Ordum City" },
  // Add other empire claims here as needed, e.g.:
  // { id: "1234567890123456789", name: "Ordum Outpost" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ResourceItem {
  item_id: number;
  name: string;
  description: string;
  icon_asset_name: string;
  tier: number;
  tag: string;
  rarity?: string;
  item_type: "Item" | "Cargo";
  quantity: number;
  durability?: number | null;
}

export interface ResourceWithLocations extends ResourceItem {
  locations: ResourceLocation[];
}

export interface ResourceLocation {
  owner_type: "Building" | "Player" | "Unknown";
  owner_name: string | null;
  building_name: string | null;
  building_description_id: number | null;
  quantity: number;
  inventory_entity_id: number;
}

export interface MemberInfo {
  entity_id: string;
  user_name: string;
  online: boolean;
  inventory_permission: boolean;
  build_permission: boolean;
  officer_permission: boolean;
  co_owner_permission: boolean;
  skills: Record<string, { level: number; experience: number; rank: number }>;
  inventory_items: ResourceItem[];
  tool_items: ResourceItem[];
}

export interface ClaimSummary {
  entity_id: string;
  name: string;
  region: string;
  tier: number | null;
  supplies: number;
  treasury: number;
  num_tiles: number;
  member_count: number;
  building_count: number;
  building_resources: ResourceWithLocations[];
  player_resources: ResourceWithLocations[];
  player_offline_resources: ResourceWithLocations[];
  tool_resources: ResourceItem[];
  tool_offline_resources: ResourceItem[];
  members: MemberInfo[];
}

export interface EmpireSummary {
  claims: ClaimSummary[];
  totals: {
    total_members: number;
    online_members: number;
    total_buildings: number;
    total_building_resource_types: number;
    total_building_resource_count: number;
    total_player_resource_types: number;
    total_player_resource_count: number;
    total_tool_types: number;
    total_tool_count: number;
  };
  /** All resources across the empire, merged and sorted by quantity desc */
  all_building_resources: ResourceItem[];
  all_player_resources: ResourceItem[];
  all_tool_resources: ResourceItem[];
  fetched_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mergeResources(items: ResourceItem[]): ResourceItem[] {
  const map = new Map<string, ResourceItem>();
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

/**
 * Build ResourceWithLocations from BitJita claim building inventories,
 * using the items/cargos lookup dictionaries for names.
 */
function parseBuildingInventories(
  buildings: JitaClaimBuildingInventory[],
  itemsDict: Record<string, { name: string; iconAssetName: string; tier: number; tag: string; rarityStr: string }>,
  cargosDict: Record<string, { name: string; iconAssetName: string; tier: number; tag: string; rarityStr: string }>,
): ResourceWithLocations[] {
  // Aggregate by item key, collecting locations
  const byKey = new Map<string, ResourceWithLocations>();

  for (const building of buildings) {
    // Skip bank buildings (personal storage)
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

      // Check if there's already a location for this building
      const existingLoc = entry.locations.find(
        (l) => l.building_name === buildingLabel,
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

// ─── Main Fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch claim data using the BitJita API.
 */
export async function fetchClaimData(
  claimIdStr: string,
): Promise<ClaimSummary> {
  const [{ claim }, claimInv, claimMembers] = await Promise.all([
    api.getClaim(claimIdStr),
    api.getClaimInventories(claimIdStr),
    api.getClaimMembers(claimIdStr),
  ]);

  // Build item/cargo lookup dicts from the inventories response
  const itemsDict: Record<string, any> = {};
  for (const item of claimInv.items ?? []) {
    itemsDict[String(item.id)] = item;
  }
  const cargosDict: Record<string, any> = {};
  for (const cargo of claimInv.cargos ?? []) {
    cargosDict[String(cargo.id)] = cargo;
  }

  // Parse building resources (with locations), excluding bank buildings
  const buildingResources = parseBuildingInventories(
    claimInv.buildings ?? [],
    itemsDict,
    cargosDict,
  );

  // Parse members from BitJita claim members endpoint
  const members: MemberInfo[] = (claimMembers.members ?? []).map(
    (m: JitaClaimMember) => ({
      entity_id: m.playerEntityId,
      user_name: m.userName,
      online: false, // BitJita members endpoint doesn't include online status
      inventory_permission: m.inventoryPermission === 1,
      build_permission: m.buildPermission === 1,
      officer_permission: m.officerPermission === 1,
      co_owner_permission: m.coOwnerPermission === 1,
      skills: {},
      inventory_items: [],
      tool_items: [],
    }),
  );

  return {
    entity_id: claim.entityId,
    name: claim.name,
    region: claim.regionName,
    tier: claim.tier ?? null,
    supplies: Number(claim.supplies) || 0,
    treasury: Number(claim.treasury) || 0,
    num_tiles: claim.numTiles,
    member_count: members.length,
    building_count: (claimInv.buildings ?? []).length,
    building_resources: buildingResources,
    player_resources: [], // BitJita doesn't aggregate player inventories at claim level
    player_offline_resources: [],
    tool_resources: [],
    tool_offline_resources: [],
    members: members.sort((a, b) =>
      a.online === b.online ? 0 : a.online ? -1 : 1,
    ),
  };
}

export async function fetchEmpireData(
  claimIds: { id: string; name: string }[] = EMPIRE_CLAIM_IDS,
): Promise<EmpireSummary> {
  const claims: ClaimSummary[] = [];
  for (const { id } of claimIds) {
    try {
      const claim = await fetchClaimData(id);
      claims.push(claim);
    } catch (err) {
      console.error(`Failed to fetch claim ${id}:`, err);
    }
  }

  // Aggregate totals
  let total_members = 0;
  let online_members = 0;
  let total_buildings = 0;
  const allBuildingRes: ResourceItem[] = [];
  const allPlayerRes: ResourceItem[] = [];
  const allToolRes: ResourceItem[] = [];

  for (const claim of claims) {
    total_members += claim.member_count;
    online_members += claim.members.filter((m) => m.online).length;
    total_buildings += claim.building_count;

    for (const r of claim.building_resources) {
      allBuildingRes.push(r);
    }
    for (const r of [
      ...claim.player_resources,
      ...claim.player_offline_resources,
    ]) {
      allPlayerRes.push(r);
    }
    for (const r of [
      ...claim.tool_resources,
      ...claim.tool_offline_resources,
    ]) {
      allToolRes.push(r);
    }
  }

  const mergedBuilding = mergeResources(allBuildingRes);
  const mergedPlayer = mergeResources(allPlayerRes);
  const mergedTools = mergeResources(allToolRes);

  return {
    claims,
    totals: {
      total_members,
      online_members,
      total_buildings,
      total_building_resource_types: mergedBuilding.length,
      total_building_resource_count: mergedBuilding.reduce(
        (s, r) => s + r.quantity,
        0,
      ),
      total_player_resource_types: mergedPlayer.length,
      total_player_resource_count: mergedPlayer.reduce(
        (s, r) => s + r.quantity,
        0,
      ),
      total_tool_types: mergedTools.length,
      total_tool_count: mergedTools.reduce((s, r) => s + r.quantity, 0),
    },
    all_building_resources: mergedBuilding,
    all_player_resources: mergedPlayer,
    all_tool_resources: mergedTools,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchClaimMembers() {
  let members: { entity_id: string; user_name: string }[] = [];
  try {
    const claimMembers = await api.getClaimMembers(ORDUM_MAIN_CLAIM_ID);
    members = (claimMembers.members ?? [])
      .map((m) => ({ entity_id: m.playerEntityId, user_name: m.userName }))
      .sort((a, b) => a.user_name.localeCompare(b.user_name));
  } catch (e) {
    // Continue without members
  }
  return members;
}
