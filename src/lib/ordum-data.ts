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
 * Uses the BitcraftApiClient to pull claim details including:
 *  - Building inventories (resources stored in claim buildings)
 *  - Player inventories (online + offline members)
 *  - Tool inventories
 *  - Member details
 */

import {
  BitcraftApiClient,
  type ClaimDescriptionStateWithInventoryAndPlayTime,
  type ClaimDescriptionStateMember,
  type ExpendedRefrence,
  type InventoryItemLocation,
  type BuildingStateModel,
} from "../bitcraft-api-client";
import { BANK_BUILDING_IDS } from "./claim-inventory";

// ─── Configuration ─────────────────────────────────────────────────────────────

export const API_BASE_URL = "https://craft-api.resubaka.dev";

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
  entity_id: number;
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
  entity_id: number;
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

function parseExpendedRef(ref: ExpendedRefrence): ResourceItem {
  const item = (ref as any).item ?? {};
  return {
    item_id: ref.item_id,
    name: ref.name ?? item.name ?? `Item #${ref.item_id}`,
    description: item.description ?? "",
    icon_asset_name: ref.icon_asset_name ?? item.icon_asset_name ?? "",
    tier: item.tier ?? 0,
    tag: item.tag ?? "",
    rarity: item.rarity,
    item_type: (ref as any).item_type ?? "Item",
    quantity: ref.quantity ?? 0,
    durability: (ref as any).durability ?? null,
  };
}

function parseInventoryLocation(
  loc: InventoryItemLocation,
): ResourceWithLocations {
  const item = (loc as any).item ?? {};
  return {
    item_id: loc.item_id,
    name: item.name ?? `Item #${loc.item_id}`,
    description: item.description ?? "",
    icon_asset_name: item.icon_asset_name ?? "",
    tier: item.tier ?? 0,
    tag: item.tag ?? "",
    rarity: item.rarity,
    item_type: loc.item_type,
    quantity: 0, // will be summed from locations
    durability: loc.durability,
    locations: loc.locations.map((l) => ({
      owner_type: l.owner_type,
      owner_name: l.owner_name,
      building_name: l.building_name,
      building_description_id: l.building_description_id ?? null,
      quantity: l.quantity,
      inventory_entity_id: l.inventory_entity_id,
    })),
  };
}

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

// ─── Main Fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch claim data using string-based ID to avoid JS number precision loss.
 * The Bitcraft entity IDs exceed Number.MAX_SAFE_INTEGER, so we must use
 * the raw string form in the URL.
 */
export async function fetchClaimData(
  client: BitcraftApiClient,
  claimIdStr: string,
): Promise<ClaimSummary> {
  const raw = await client.getClaim(claimIdStr);

  // Parse building resources (with locations), excluding bank buildings (personal storage)
  const buildingLocs: ResourceWithLocations[] = [];
  const buildingLocArray = (raw.inventory_locations as any)?.buildings ?? [];
  for (const loc of buildingLocArray) {
    const parsed = parseInventoryLocation(loc);
    // Filter out bank building locations
    parsed.locations = parsed.locations.filter(
      (l) => !BANK_BUILDING_IDS.has(l.building_description_id ?? 0),
    );
    parsed.quantity = parsed.locations.reduce((sum, l) => sum + l.quantity, 0);
    if (parsed.quantity > 0) buildingLocs.push(parsed);
  }

  // Parse player resources (with locations)
  const playerLocs: ResourceWithLocations[] = [];
  const playerLocArray = (raw.inventory_locations as any)?.players ?? [];
  for (const loc of playerLocArray) {
    const parsed = parseInventoryLocation(loc);
    parsed.quantity = parsed.locations.reduce((sum, l) => sum + l.quantity, 0);
    playerLocs.push(parsed);
  }

  // Parse offline player resources
  const offlineLocs: ResourceWithLocations[] = [];
  const offlineLocArray =
    (raw.inventory_locations as any)?.players_offline ?? [];
  for (const loc of offlineLocArray) {
    const parsed = parseInventoryLocation(loc);
    parsed.quantity = parsed.locations.reduce((sum, l) => sum + l.quantity, 0);
    offlineLocs.push(parsed);
  }

  // Parse tools
  const toolItems: ResourceItem[] = [];
  const toolArray = (raw.tool_inventorys as any)?.players ?? [];
  for (const ref of toolArray) {
    toolItems.push(parseExpendedRef(ref));
  }

  const toolOfflineItems: ResourceItem[] = [];
  const toolOfflineArray = (raw.tool_inventorys as any)?.players_offline ?? [];
  for (const ref of toolOfflineArray) {
    toolOfflineItems.push(parseExpendedRef(ref));
  }

  // Parse members
  const members: MemberInfo[] = [];
  const rawMembers = raw.members ?? {};
  for (const [, m] of Object.entries(rawMembers) as [
    string,
    ClaimDescriptionStateMember,
  ][]) {
    const skills: Record<
      string,
      { level: number; experience: number; rank: number }
    > = {};
    const rawSkills = (m as any).skills_ranks ?? {};
    for (const [skillName, s] of Object.entries(rawSkills) as [string, any][]) {
      skills[skillName] = {
        level: s.level ?? 0,
        experience: s.experience ?? 0,
        rank: s.rank ?? 0,
      };
    }

    // Extract inventory items from member's resolved inventory
    const inv_items: ResourceItem[] = [];
    const tool_items: ResourceItem[] = [];
    if (m.inventory) {
      const pockets = (m.inventory as any).pockets ?? [];
      for (const pocket of pockets) {
        if (pocket.contents) {
          const c = pocket.contents;
          inv_items.push({
            item_id: c.item_id,
            name: c.item?.name ?? `Item #${c.item_id}`,
            description: c.item?.description ?? "",
            icon_asset_name: c.item?.icon_asset_name ?? "",
            tier: c.item?.tier ?? 0,
            tag: c.item?.tag ?? "",
            rarity: c.item?.rarity,
            item_type: c.item_type ?? "Item",
            quantity: c.quantity ?? 1,
            durability: c.durability,
          });
        }
      }
    }

    members.push({
      entity_id: m.entity_id,
      user_name: m.user_name,
      online: m.online_state === "Online",
      inventory_permission: m.inventory_permission,
      build_permission: m.build_permission,
      officer_permission: m.officer_permission,
      co_owner_permission: m.co_owner_permission,
      skills,
      inventory_items: inv_items,
      tool_items: tool_items,
    });
  }

  return {
    entity_id: raw.entity_id,
    name: raw.name,
    region: raw.region,
    tier: raw.tier ?? null,
    supplies: raw.supplies,
    treasury: raw.treasury,
    num_tiles: raw.num_tiles,
    member_count: members.length,
    building_count: (raw.building_states ?? []).length,
    building_resources: buildingLocs.sort((a, b) => b.quantity - a.quantity),
    player_resources: playerLocs.sort((a, b) => b.quantity - a.quantity),
    player_offline_resources: offlineLocs.sort(
      (a, b) => b.quantity - a.quantity,
    ),
    tool_resources: toolItems.sort((a, b) => b.quantity - a.quantity),
    tool_offline_resources: toolOfflineItems.sort(
      (a, b) => b.quantity - a.quantity,
    ),
    members: members.sort((a, b) =>
      a.online === b.online ? 0 : a.online ? -1 : 1,
    ),
  };
}

export async function fetchEmpireData(
  client: BitcraftApiClient,
  claimIds: { id: string; name: string }[] = EMPIRE_CLAIM_IDS,
): Promise<EmpireSummary> {
  const claims: ClaimSummary[] = [];
  for (const { id } of claimIds) {
    try {
      const claim = await fetchClaimData(client, id);
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
