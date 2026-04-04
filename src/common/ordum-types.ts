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
 * Ordum Empire — shared types and constants.
 * This module has no server-side dependencies and is safe to import from client code.
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Ordum empire entity ID for direct BitJita API lookups */
export const ORDUM_EMPIRE_ID = "379564";

/** A claim entry as returned by the /api/empire-claims endpoint */
export interface EmpireClaimInfo {
  id: string;
  name: string;
}

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
  owner_building_entity_id: string;
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
    total_tiles: number;
    total_building_resource_types: number;
    total_building_resource_count: number;
    total_player_resource_types: number;
    total_player_resource_count: number;
    total_tool_types: number;
    total_tool_count: number;
  };
  hexite_reserve: number;
  capital_claim_entity_id: string | null;
  all_building_resources: ResourceItem[];
  all_player_resources: ResourceItem[];
  all_tool_resources: ResourceItem[];
  fetched_at: string;
}
