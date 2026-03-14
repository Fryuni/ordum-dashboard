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
 * ═══════════════════════════════════════════════════════════════════════════════
 * Bitcraft Hub API Client — Auto-generated
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Source: https://github.com/ResuBaka/bitcraft-hub/tree/main/rust/api-server/api/src
 * Generated: 2026-03-14T00:08:36.927Z
 *
 * Re-generate with:
 *   bun run generate-api-client.ts
 *
 * Usage:
 *   import { BitcraftApiClient } from "./bitcraft-api-client";
 *   const client = new BitcraftApiClient("https://bitcraft-hub.example.com");
 *   const players = await client.listPlayers({ page: 1, per_page: 20 });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════════
// Entity Model Types
// ═══════════════════════════════════════════════════════════════════════════════

// Entity model types — opaque types for database models referenced by the API.
// These represent rows from the backing database; fields vary by table.

export interface PlayerStateModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface MobileEntityStateModel {
  entity_id: number;
  location_x: number;
  location_y: number;
  location_z: number;
  chunk_index: number;
  dimension: number;
  region: string;
  [key: string]: unknown;
}
export interface ClaimStateModel {
  entity_id: number;
  name: string;
  [key: string]: unknown;
}
export interface ClaimTileStateModel {
  claim_id: number;
  [key: string]: unknown;
}
export interface ClaimMemberStateModel {
  entity_id: number;
  player_entity_id: number;
  claim_entity_id: number;
  user_name: string;
  [key: string]: unknown;
}
export interface ClaimLocalStateModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface BuildingStateModel {
  entity_id: number;
  claim_entity_id: number;
  building_description_id: number;
  direction_index: number;
  constructed_by_player_entity_id: number;
  [key: string]: unknown;
}
export interface BuildingDescModel {
  id: number;
  name: string;
  description: string;
  [key: string]: unknown;
}
export interface BuildingNicknameStateModel {
  entity_id: number;
  nickname: string;
  [key: string]: unknown;
}
export interface InventoryModel {
  entity_id: number;
  pockets: unknown[];
  inventory_index: number;
  cargo_index: number;
  owner_entity_id: number;
  player_owner_entity_id: number;
  [key: string]: unknown;
}
export interface InventoryChangelogModel {
  [key: string]: unknown;
}
export interface ItemDescModel {
  id: number;
  name: string;
  description: string;
  tier: number;
  tags: string[];
  icon_asset_name: string;
  [key: string]: unknown;
}
export interface CargoDescModel {
  id: number;
  name: string;
  description: string;
  tier: number;
  tags: string[];
  icon_asset_name: string;
  [key: string]: unknown;
}
export interface CraftingRecipeModel {
  id: number;
  name: string;
  [key: string]: unknown;
}
export interface ClaimTechDescModel {
  id: number;
  name: string;
  [key: string]: unknown;
}
export interface ItemListDescModel {
  id: number;
  name: string;
  [key: string]: unknown;
}
export interface SkillDescModel {
  id: number;
  name: string;
  [key: string]: unknown;
}
export interface LocationModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface TradeOrderModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface DeployableStateModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface AuctionListingStateModel {
  item_type: string;
  item_id: number;
  [key: string]: unknown;
}
export interface TravelerTaskDescModel {
  id: number;
  [key: string]: unknown;
}
export interface NpcDescModel {
  id: number;
  [key: string]: unknown;
}
export interface PlayerActionStateModel {
  entity_id: number;
  [key: string]: unknown;
}
export interface PlayerUsernameStateModel {
  entity_id: number;
  username: string;
  [key: string]: unknown;
}
export interface TravelerTaskStateModel {
  [key: string]: unknown;
}
export interface ExtractionRecipeDescModel {
  id: number;
  [key: string]: unknown;
}
export interface VaultStateCollectiblesModel {
  [key: string]: unknown;
}
export interface ResolvedInventory {
  entity_id: number;
  pockets: unknown[];
  inventory_index: number;
  cargo_index: number;
  owner_entity_id: number;
  player_owner_entity_id: number;
  nickname: string | null;
  claim: ClaimStateModel | null;
  [key: string]: unknown;
}
export interface PlayerStateMerged {
  entity_id: number;
  time_played: number;
  session_start_timestamp: number;
  time_signed_in: number;
  sign_in_timestamp: number;
  signed_in: boolean;
  username: string;
  [key: string]: unknown;
}
export interface AuctionListingState {
  item_type: string;
  item_id: number;
  [key: string]: unknown;
}
export interface ExpendedRefrence {
  item_id: number;
  item_type: string;
  quantity: number;
  name: string;
  icon_asset_name: string;
  [key: string]: unknown;
}
export interface PlayerLeaderboardResponse {
  [category: string]: unknown;
}
export interface ItemExpended {
  [key: string]: unknown;
}
export interface TeleportLocation {
  [key: string]: unknown;
}
export interface Timestamp {
  seconds: number;
  microseconds: number;
}
export interface ProbabilisticItemStack {
  item_id: number;
  quantity_min: number;
  quantity_max: number;
  probability: number;
}
export interface ToolRequirement {
  tool_tag: string;
  durability_cost: number;
}
export interface Location {
  x: number;
  y: number;
  z: number;
}
export type ItemType = "Item" | "Cargo";
export interface VaultStateCollectibleWithDesc {
  [key: string]: unknown;
}
export interface ApiResponse {
  id: number;
  name: string;
  description: string;
  count: number;
  [key: string]: unknown;
}
export interface ActionStateModel {
  owner_entity_id: number;
  entity_id: number;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Response / Request Types (parsed from Rust source)
// ═══════════════════════════════════════════════════════════════════════════════

export type WebsocketEncoding = "Json" | "Toml" | "Yaml" | "MessagePack";

export interface PermissionEntry {
  allowed_entity_id: number;
  allowed_username?: string | null;
  group: number;
  rank: number;
  [key: string]: unknown;
}

export interface HouseResponse {
  entity_id: number;
  entrance_building_entity_id: number;
  network_entity_id: number;
  exit_portal_entity_id: number;
  rank: number;
  is_empty: boolean;
  region_index: number;
  region: string;
  owner_entity_id: number;
  owner_username?: string | null;
  permissions: PermissionEntry[];
  [key: string]: unknown;
}

export interface HousesResponse {
  houses: HouseResponse[];
  page: number;
  per_page: number;
  total: number;
  [key: string]: unknown;
}

export interface HouseInventoriesResponse {
  house_entity_id: number;
  dimension_id?: number | null;
  inventories: ResolvedInventory[];
  [key: string]: unknown;
}

export interface ClaimDescriptionState {
  entity_id: number;
  owner_player_entity_id: number;
  owner_building_entity_id: number;
  name: string;
  supplies: number;
  building_maintenance: number;
  members: ClaimDescriptionStateMember[];
  num_tiles: number;
  extensions: number;
  neutral: boolean;
  location?: Location | null;
  treasury: number;
  running_upgrade?: ClaimTechDescModel | null;
  running_upgrade_started?: Timestamp | null;
  tier?: number | null;
  upgrades: ClaimTechDescModel[];
  xp_gained_since_last_coin_minting: number;
  region: string;
  [key: string]: unknown;
}

export interface ClaimDescriptionStateWithInventoryAndPlayTime {
  entity_id: number;
  owner_player_entity_id: number;
  owner_building_entity_id: number;
  name: string;
  region: string;
  supplies: number;
  building_maintenance: number;
  members: Record<number, ClaimDescriptionStateMember>;
  num_tiles: number;
  extensions: number;
  neutral: boolean;
  location?: Location | null;
  treasury: number;
  xp_gained_since_last_coin_minting: number;
  running_upgrade?: ClaimTechDescModel | null;
  running_upgrade_started?: Timestamp | null;
  tier?: number | null;
  upgrades: ClaimTechDescModel[];
  learned_upgrades: number[];
  inventorys: Record<string, ExpendedRefrence[]>;
  inventory_locations: Record<string, InventoryItemLocation[]>;
  tool_inventorys: Record<string, ExpendedRefrence[]>;
  tool_inventory_locations: Record<string, InventoryItemLocation[]>;
  traveler_tasks: Record<string, Record<number, number[]>>;
  time_signed_in: number;
  building_states: BuildingStateModel[];
  [key: string]: unknown;
}

export interface InventoryLocationEntry {
  inventory_entity_id: number;
  owner_entity_id: number;
  player_owner_entity_id: number;
  inventory_index: number;
  cargo_index: number;
  owner_type: InventoryOwnerType;
  owner_name?: string | null;
  building_name?: string | null;
  building_description_id?: number | null;
  quantity: number;
  [key: string]: unknown;
}

export interface InventoryItemLocation {
  item_id: number;
  item: ItemExpended;
  item_type: ItemType;
  durability?: number | null;
  locations: InventoryLocationEntry[];
  [key: string]: unknown;
}

export interface ClaimResponse {
  claims: ClaimDescriptionState[];
  perPage: number;
  total: number;
  page: number;
  [key: string]: unknown;
}

export interface ClaimDescriptionStateMember {
  entity_id: number;
  user_name: string;
  inventory_permission: boolean;
  build_permission: boolean;
  officer_permission: boolean;
  co_owner_permission: boolean;
  online_state: OnlineState;
  skills_ranks?: Record<string, LeaderboardSkill> | null;
  inventory?: ResolvedInventory | null;
  [key: string]: unknown;
}

export interface InventoryJobResult {
  key: string;
  inventorys: ExpendedRefrence[];
  locations: InventoryItemLocation[];
  tool_inventorys?: ExpendedRefrence[] | null;
  tool_locations?: InventoryItemLocation[] | null;
  [key: string]: unknown;
}

export interface ItemLocationsBuilder {
  item_id: number;
  item: ItemExpended;
  item_type: ItemType;
  durability?: number | null;
  locations: Record<number, InventoryLocationEntry>;
  [key: string]: unknown;
}

export type InventoryOwnerType = "Player" | "Building" | "Unknown";

export type OnlineState = "Online" | "Offline";

export interface BuildingDescriptionsResponse {
  buildings: ApiResponse[];
  per_page: number;
  total: number;
  page: number;
  [key: string]: unknown;
}

export interface BuildingStateWithName {
  entity_id: number;
  claim_entity_id: number;
  direction_index: number;
  building_description_id: number;
  constructed_by_player_entity_id: number;
  building_name: string;
  location?: LocationModel | null;
  [key: string]: unknown;
}

export interface BuildingStatesResponse {
  buildings: BuildingStateWithName[];
  per_page: number;
  total: number;
  page: number;
  [key: string]: unknown;
}

export interface ExtractionRecipeResponse {
  id: number;
  resource_id: number;
  tool_requirements: ToolRequirement[];
  allow_use_hands: boolean;
  time_requirement: number;
  stamina_requirement: number;
  [key: string]: unknown;
}

export interface MarketOrdersResponse {
  buy_orders: Record<string, AuctionListingState[]>;
  sell_orders: Record<string, AuctionListingState[]>;
  [key: string]: unknown;
}

export interface InventorysResponse {
  inventorys: ResolvedInventory[];
  total: number;
  page: number;
  perPage: number;
  [key: string]: unknown;
}

export interface AllInventoryStatsResponse {
  items: [number, ItemDescModel | null][];
  cargo: [number, CargoDescModel | null][];
  [key: string]: unknown;
}

export interface ItemsAndCargoResponse {
  items: ItemCargo[];
  tags: string[];
  tiers: number[];
  per_page: number;
  total: number;
  page: number;
  pages: number;
  [key: string]: unknown;
}

export interface MetaResponse {
  tags: string[];
  tiers: number[];
  [key: string]: unknown;
}

export interface ItemsAndCargollResponse {
  cargo_desc: Record<number, CargoDescModel>;
  item_desc: Record<number, ItemDescModel>;
  [key: string]: unknown;
}

export type ItemCargo = { type: "Item" } | { type: "Cargo" };

export interface LeaderboardSkill {
  player_id: number;
  player_name?: string | null;
  experience: number;
  level: number;
  rank: number;
  [key: string]: unknown;
}

export interface LeaderboardLevel {
  player_id: number;
  player_name?: string | null;
  level: number;
  rank: number;
  [key: string]: unknown;
}

export interface LeaderboardExperiencePerHour {
  player_id: number;
  player_name?: string | null;
  experience: number;
  rank: number;
  [key: string]: unknown;
}

export interface LeaderboardExperience {
  player_id: number;
  player_name?: string | null;
  experience: number;
  experience_per_hour: number;
  rank: number;
  [key: string]: unknown;
}

export interface LeaderboardTime {
  player_id: number;
  player_name?: string | null;
  time_played: number;
  rank: number;
  [key: string]: unknown;
}

export interface GetTop100Response {
  player_map: Record<number, PlayerStateModel>;
  leaderboard: Record<string, RankType[]>;
  [key: string]: unknown;
}

export type RankType =
  | LeaderboardExperience
  | LeaderboardExperiencePerHour
  | LeaderboardLevel
  | LeaderboardSkill
  | LeaderboardTime;

export interface TradeOrdersWithExpendedRefrence {
  entity_id: number;
  remaining_stock: number;
  offer_items: ExpendedRefrence[];
  offer_cargo_id: number[];
  required_items: ExpendedRefrence[];
  required_cargo_id: number[];
  region: string;
  shop_entity_id: number;
  traveler_trade_order_id?: number | null;
  [key: string]: unknown;
}

export interface TradeOrdersResponse {
  trade_orders: TradeOrdersWithExpendedRefrence[];
  total: number;
  page: number;
  perPage: number;
  [key: string]: unknown;
}

export interface PlayerUsernameStateResponse {
  username_state: Record<string, string>;
  [key: string]: unknown;
}

export interface PlayersResponse {
  players: PlayerStateMerged[];
  perPage: number;
  total: number;
  page: number;
  [key: string]: unknown;
}

export interface FindPlayerByIdResponse {
  teleport_location: TeleportLocation;
  entity_id: number;
  time_played: number;
  session_start_timestamp: number;
  time_signed_in: number;
  sign_in_timestamp: number;
  signed_in: boolean;
  traveler_tasks_expiration: number;
  traveler_tasks: Record<number, TravelerTaskStateModel[]>;
  username: string;
  deployables: VaultStateCollectibleWithDesc[];
  claim_id?: number | null;
  claims: ClaimStateModel[];
  player_location?: MobileEntityStateModel | null;
  player_action_state?: string | null;
  player_action_state2?: PlayerActionStateModel | null;
  current_action_state?: PlayerActionStateModel | null;
  [key: string]: unknown;
}

export interface RecipesAllResponse {
  recipes: Record<number, CraftingRecipeModel>;
  cargo_desc: Record<number, CargoDescModel>;
  item_desc: Record<number, ItemDescModel>;
  item_list_desc: Record<number, ItemListDescModel>;
  [key: string]: unknown;
}

// ─── Query Parameter Types ────────────────────────────────────────────────────

export interface Params {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface FindHousesQuery {
  page?: number;
  per_page?: number;
  owner?: string;
}

export interface ListClaimsParams {
  page?: number;
  per_page?: number;
  search?: string;
  research?: number;
  running_upgrade?: boolean;
}

export interface BuildingStatesParams {
  page?: number;
  per_page?: number;
  claim_entity_id?: number;
  with_inventory?: boolean;
  skip_static_buildings?: boolean;
}

export interface InventoryChangesParams {
  item_id?: number;
  item_type?: ItemType;
  user_id?: number;
}

export interface ItemsAndCargoParams {
  page?: number;
  per_page?: number;
  search?: string;
  tier?: number;
  tag?: string;
  no_item_list?: boolean;
}

export interface ListPlayersParams {
  page?: number;
  per_page?: number;
  search?: string;
  online?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client Error
// ═══════════════════════════════════════════════════════════════════════════════

export class BitcraftApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`Bitcraft API error ${status} ${statusText} for ${url}`);
    this.name = "BitcraftApiError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Client Options
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitcraftApiClientOptions {
  /** Base URL of the Bitcraft Hub API server. No trailing slash. */
  baseUrl: string;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Default headers for every request. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Default: 30000. */
  timeout?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client
// ═══════════════════════════════════════════════════════════════════════════════

export class BitcraftApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;

  constructor(baseUrlOrOptions: string | BitcraftApiClientOptions) {
    if (typeof baseUrlOrOptions === "string") {
      this.baseUrl = baseUrlOrOptions.replace(/\/+$/, "");
      this.fetchFn = globalThis.fetch.bind(globalThis);
      this.defaultHeaders = {};
      this.timeout = 30_000;
    } else {
      this.baseUrl = baseUrlOrOptions.baseUrl.replace(/\/+$/, "");
      this.fetchFn =
        baseUrlOrOptions.fetch ?? globalThis.fetch.bind(globalThis);
      this.defaultHeaders = baseUrlOrOptions.headers ?? {};
      this.timeout = baseUrlOrOptions.timeout ?? 30_000;
    }
  }

  private buildQuery(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        parts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
        );
      }
    }
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }

  protected async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json", ...this.defaultHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new BitcraftApiError(
          response.status,
          response.statusText,
          body,
          url,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── API Methods (33 endpoints) ─────────────────────────────

  /**
   * `GET /desc/buildings/{id}`
   */
  async findClaimDescription(id: number): Promise<BuildingDescModel> {
    return this.request<BuildingDescModel>(`/desc/buildings/${id}`);
  }

  /**
   * `GET /api/bitcraft/desc/buildings`
   */
  async findBuildingDescriptions(): Promise<BuildingDescriptionsResponse> {
    return this.request<BuildingDescriptionsResponse>(
      "/api/bitcraft/desc/buildings",
    );
  }

  /**
   * `GET /items`
   */
  async listItems(): Promise<unknown> {
    return this.request<unknown>("/items");
  }

  /**
   * `GET /items/world`
   */
  async listWorldItems(): Promise<Record<number, ItemDescModel>> {
    return this.request<Record<number, ItemDescModel>>("/items/world");
  }

  /**
   * `GET /api/bitcraft/houses`
   */
  async findHouses(params?: {
    page?: number;
    per_page?: number;
    owner?: string;
  }): Promise<HousesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<HousesResponse>("/api/bitcraft/houses" + query);
  }

  /**
   * `GET /api/bitcraft/houses/by_owner/{id}`
   */
  async findHousesByOwnerId(id: number): Promise<HouseResponse[]> {
    return this.request<HouseResponse[]>(`/api/bitcraft/houses/by_owner/${id}`);
  }

  /**
   * `GET /api/bitcraft/houses/{id}`
   */
  async findHouse(id: number): Promise<HouseResponse> {
    return this.request<HouseResponse>(`/api/bitcraft/houses/${id}`);
  }

  /**
   * `GET /api/bitcraft/houses/{id}/inventories`
   */
  async findHouseInventories(id: number): Promise<HouseInventoriesResponse> {
    return this.request<HouseInventoriesResponse>(
      `/api/bitcraft/houses/${id}/inventories`,
    );
  }

  /**
   * `GET /api/bitcraft/claims`
   */
  async listClaims(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    research?: number;
    running_upgrade?: boolean;
  }): Promise<ClaimResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ClaimResponse>("/api/bitcraft/claims" + query);
  }

  /**
   * `GET /api/bitcraft/claims/{id}`
   */
  async getClaim(
    id: number | string,
  ): Promise<ClaimDescriptionStateWithInventoryAndPlayTime> {
    return this.request<ClaimDescriptionStateWithInventoryAndPlayTime>(
      `/api/bitcraft/claims/${id}`,
    );
  }

  /**
   * `GET /claims/tiles/{id}`
   */
  async getClaimTiles(id: number): Promise<ClaimTileStateModel[]> {
    return this.request<ClaimTileStateModel[]>(`/claims/tiles/${id}`);
  }

  /**
   * `GET /claims/inventory_changelog/{id}`
   */
  async getClaimInventoryChangeLog(
    id: number,
  ): Promise<InventoryChangelogModel[]> {
    return this.request<InventoryChangelogModel[]>(
      `/claims/inventory_changelog/${id}`,
    );
  }

  /**
   * `GET /api/bitcraft/buildings`
   */
  async findBuildingStates(params?: {
    page?: number;
    per_page?: number;
    claim_entity_id?: number;
    with_inventory?: boolean;
    skip_static_buildings?: boolean;
  }): Promise<BuildingStatesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<BuildingStatesResponse>(
      "/api/bitcraft/buildings" + query,
    );
  }

  /**
   * `GET /api/bitcraft/buildings/{id}`
   */
  async findBuildingState(id: number): Promise<BuildingStateModel> {
    return this.request<BuildingStateModel>(`/api/bitcraft/buildings/${id}`);
  }

  /**
   * `GET /market`
   */
  async findMarketPlaceOrder(): Promise<MarketOrdersResponse> {
    return this.request<MarketOrdersResponse>("/market");
  }

  /**
   * `GET /api/bitcraft/inventorys/changes/{id}`
   */
  async readInventoryChanges(
    id: number,
    params?: {
      item_id?: number;
      item_type?: ItemType;
      user_id?: number;
    },
  ): Promise<InventoryChangelogModel[]> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<InventoryChangelogModel[]>(
      `/api/bitcraft/inventorys/changes/${id}` + query,
    );
  }

  /**
   * `GET /api/bitcraft/inventorys/owner_entity_id/{id}`
   */
  async findInventoryByOwnerEntityId(id: number): Promise<InventorysResponse> {
    return this.request<InventorysResponse>(
      `/api/bitcraft/inventorys/owner_entity_id/${id}`,
    );
  }

  /**
   * `GET /inventory/{id}`
   */
  async findInventoryById(id: number): Promise<InventoryModel> {
    return this.request<InventoryModel>(`/inventory/${id}`);
  }

  /**
   * `GET /inventory/all_inventory_stats`
   */
  async allInventoryStats(): Promise<AllInventoryStatsResponse> {
    return this.request<AllInventoryStatsResponse>(
      "/inventory/all_inventory_stats",
    );
  }

  /**
   * `GET /api/bitcraft/itemsAndCargo`
   */
  async listItemsAndCargo(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    tier?: number;
    tag?: string;
    no_item_list?: boolean;
  }): Promise<ItemsAndCargoResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ItemsAndCargoResponse>(
      "/api/bitcraft/itemsAndCargo" + query,
    );
  }

  /**
   * `GET /api/bitcraft/itemsAndCargo/all`
   */
  async getItemsAndCargo(): Promise<ItemsAndCargollResponse> {
    return this.request<ItemsAndCargollResponse>(
      "/api/bitcraft/itemsAndCargo/all",
    );
  }

  /**
   * `GET /leaderboard`
   */
  async getTop100(): Promise<GetTop100Response> {
    return this.request<GetTop100Response>("/leaderboard");
  }

  /**
   * `GET /api/bitcraft/experience/{player_id}`
   */
  async playerLeaderboard(
    player_id: number,
  ): Promise<PlayerLeaderboardResponse> {
    return this.request<PlayerLeaderboardResponse>(
      `/api/bitcraft/experience/${player_id}`,
    );
  }

  /**
   * `GET /api/bitcraft/leaderboard/claims/{claim_id}`
   */
  async getClaimLeaderboard(claim_id: number): Promise<GetTop100Response> {
    return this.request<GetTop100Response>(
      `/api/bitcraft/leaderboard/claims/${claim_id}`,
    );
  }

  /**
   * `GET /api/bitcraft/trade_orders/get_trade_orders`
   */
  async getTradeOrders(): Promise<TradeOrdersResponse> {
    return this.request<TradeOrdersResponse>(
      "/api/bitcraft/trade_orders/get_trade_orders",
    );
  }

  /**
   * `GET /traveler_tasks`
   */
  async getTravelerTasks(): Promise<Record<number, TravelerTaskDescModel>> {
    return this.request<Record<number, TravelerTaskDescModel>>(
      "/traveler_tasks",
    );
  }

  /**
   * `GET /npc`
   */
  async getNpcAll(): Promise<Record<number, NpcDescModel>> {
    return this.request<Record<number, NpcDescModel>>("/npc");
  }

  /**
   * `GET /api/bitcraft/players`
   */
  async listPlayers(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    online?: boolean;
  }): Promise<PlayersResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<PlayersResponse>("/api/bitcraft/players" + query);
  }

  /**
   * `GET /api/bitcraft/players/{id}`
   */
  async findPlayerById(id: number): Promise<FindPlayerByIdResponse> {
    return this.request<FindPlayerByIdResponse>(`/api/bitcraft/players/${id}`);
  }

  /**
   * `GET /api/bitcraft/players/all`
   */
  async getPlayers(): Promise<PlayerUsernameStateResponse> {
    return this.request<PlayerUsernameStateResponse>(
      "/api/bitcraft/players/all",
    );
  }

  /**
   * `GET /recipes/get_all`
   */
  async getRecipes(): Promise<RecipesAllResponse> {
    return this.request<RecipesAllResponse>("/recipes/get_all");
  }

  /**
   * `GET /api/bitcraft/extractionRecipes/all`
   */
  async getExtractionRecipes(): Promise<ExtractionRecipeResponse[]> {
    return this.request<ExtractionRecipeResponse[]>(
      "/api/bitcraft/extractionRecipes/all",
    );
  }

  /**
   * `GET /api/bitcraft/itemsAndCargo/meta`
   */
  async getItemsAndCargoMeta(): Promise<MetaResponse> {
    return this.request<MetaResponse>("/api/bitcraft/itemsAndCargo/meta");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Message Types (parsed from Rust WebSocketMessages enum)
// ═══════════════════════════════════════════════════════════════════════════════

export interface WsMsgExperience {
  experience: number;
  level: number;
  rank: number;
  skill_name: string;
  user_id: number;
}

export interface WsMsgTotalExperience {
  user_id: number;
  experience: number;
  experience_per_hour: number;
  rank: number;
}

export interface WsMsgTimePlayed {
  user_id: number;
  time: number;
  rank: number;
}

export interface WsMsgTimeSignedIn {
  user_id: number;
  time: number;
  rank: number;
}

export interface WsMsgMovedOutOfClaim {
  user_id: number;
  chunk_index: number;
  claim_id: number;
}

export interface WsMsgMovedIntoClaim {
  user_id: number;
  chunk_index: number;
  claim_id: number;
}

export interface WsMsgPlayerMovedIntoClaim {
  user_id: number;
  chunk_index: number;
  claim_id: number;
}

export interface WsMsgPlayerMovedOutOfClaim {
  user_id: number;
  chunk_index: number;
  claim_id: number;
}

export interface WsMsgLevel {
  level: number;
  user_id: number;
  skill_name: string;
}

export interface WsMsgInventoryUpdate {
  resolved_inventory: ResolvedInventory;
}

export interface WsMsgInventoryRemove {
  resolved_inventory: ResolvedInventory;
}

export interface WsMsgInventoryInsert {
  resolved_inventory: ResolvedInventory;
  player_owner_id: number;
}

export type WebSocketMessage =
  | { t: "MobileEntityState"; c: MobileEntityStateModel }
  | { t: "Experience"; c: WsMsgExperience }
  | { t: "TotalExperience"; c: WsMsgTotalExperience }
  | { t: "TimePlayed"; c: WsMsgTimePlayed }
  | { t: "TimeSignedIn"; c: WsMsgTimeSignedIn }
  | { t: "MovedOutOfClaim"; c: WsMsgMovedOutOfClaim }
  | { t: "MovedIntoClaim"; c: WsMsgMovedIntoClaim }
  | { t: "PlayerMovedIntoClaim"; c: WsMsgPlayerMovedIntoClaim }
  | { t: "PlayerMovedOutOfClaim"; c: WsMsgPlayerMovedOutOfClaim }
  | { t: "PlayerActionState"; c: PlayerActionStateModel }
  | { t: "PlayerActionStateChangeName"; c: [string, number] }
  | { t: "Level"; c: WsMsgLevel }
  | { t: "PlayerState"; c: PlayerStateModel }
  | { t: "TravelerTaskState"; c: TravelerTaskStateModel }
  | { t: "TravelerTaskStateDelete"; c: TravelerTaskStateModel }
  | { t: "ClaimLocalState"; c: ClaimLocalStateModel }
  | { t: "ActionState"; c: ActionStateModel }
  | { t: "InsertSellOrder"; c: AuctionListingState }
  | { t: "UpdateSellOrder"; c: AuctionListingState }
  | { t: "RemoveSellOrder"; c: AuctionListingState }
  | { t: "InsertBuyOrder"; c: AuctionListingState }
  | { t: "UpdateBuyOrder"; c: AuctionListingState }
  | { t: "RemoveBuyOrder"; c: AuctionListingState }
  | { t: "InventoryUpdate"; c: WsMsgInventoryUpdate }
  | { t: "InventoryRemove"; c: WsMsgInventoryRemove }
  | { t: "InventoryInsert"; c: WsMsgInventoryInsert };

export type WebSocketMessageType = WebSocketMessage["t"];

export type WebSocketMessageContent<T extends WebSocketMessageType> = Extract<
  WebSocketMessage,
  { t: T }
>["c"];

/** Known WebSocket topic names. Use with subscribe(). */
export type WebSocketTopic =
  | "mobile_entity_state"
  | "experience:{skill_name}"
  | "experience"
  | "moved_out_of_claim"
  | "moved_into_claim"
  | "player_moved_into_claim"
  | "player_moved_out_of_claim"
  | "player_action_state"
  | "player_action_state_change_name"
  | "level:{skill_name}"
  | "level"
  | "traveler_task_state"
  | "traveler_task_state:player"
  | "claim_local_state"
  | "action_state"
  | "insert_sell_order"
  | "insert_sell_order:item_id"
  | "update_sell_order"
  | "update_sell_order:item_id"
  | "remove_sell_order"
  | "remove_sell_order:item_id"
  | "update_buy_order"
  | "update_buy_order:item_id"
  | "remove_buy_order"
  | "remove_buy_order:item_id"
  | "inventory_update"
  | "inventory_remove"
  | "inventory_remove_owner"
  | "inventory_insert"
  | "inventory_insert_owner"
  | "inventory_insert_player_owner";

// ═══════════════════════════════════════════════════════════════════════════════
// Live Data Client (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitcraftLiveClientOptions {
  /** Base URL (http/https). Will be converted to ws/wss automatically. */
  baseUrl: string;
  /** Encoding to request from the server. Default: "Json". */
  encoding?: "Json" | "Toml" | "Yaml" | "MessagePack";
  /** Auto-reconnect on disconnect. Default: true. */
  autoReconnect?: boolean;
  /** Reconnect delay in ms. Default: 5000. */
  reconnectDelay?: number;
  /** Max reconnect attempts. Default: 10. 0 = infinite. */
  maxReconnectAttempts?: number;
}

type MessageHandler<T extends WebSocketMessageType = WebSocketMessageType> = (
  content: WebSocketMessageContent<T>,
) => void;

export class BitcraftLiveClient {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private readonly encoding: string;
  private readonly autoReconnect: boolean;
  private readonly reconnectDelay: number;
  private readonly maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  private handlers = new Map<string, Map<string, MessageHandler<any>>>();
  private subscribedTopics = new Set<string>();

  /** Fires on connection open. */
  onOpen: (() => void) | null = null;
  /** Fires on connection close. */
  onClose: ((event: CloseEvent) => void) | null = null;
  /** Fires on connection error. */
  onError: ((event: Event) => void) | null = null;
  /** Fires on every raw message (before dispatch). */
  onRawMessage: ((message: WebSocketMessage) => void) | null = null;

  constructor(options: BitcraftLiveClientOptions) {
    const base = options.baseUrl.replace(/\/+$/, "");
    const wsBase = base.replace(/^http/, "ws");
    this.encoding = options.encoding ?? "Json";
    this.wsUrl = `${wsBase}/websocket?encoding=${this.encoding}`;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  /** Current connection state. */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Open the WebSocket connection. */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.intentionallyClosed = false;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Re-subscribe to all previously subscribed topics
      if (this.subscribedTopics.size > 0) {
        this.send({
          t: "Subscribe",
          c: { topics: [...this.subscribedTopics] },
        });
      }
      this.onOpen?.();
    };

    this.ws.onclose = (event) => {
      this.onClose?.(event);
      if (!this.intentionallyClosed && this.autoReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.onError?.(event);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  /** Close the connection. */
  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Subscribe to a topic and register a typed handler for a message type.
   *
   * @param messageType  The WebSocket message type to listen for (e.g. "PlayerState")
   * @param topics       Topic string(s) to subscribe to (e.g. "player_state.12345")
   * @param handler      Callback receiving the typed message content
   * @param handlerId    Unique ID for this handler (for later removal)
   */
  subscribe<T extends WebSocketMessageType>(
    messageType: T,
    topics: string | string[],
    handler: (content: WebSocketMessageContent<T>) => void,
    handlerId: string,
  ): void {
    // Register handler
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Map());
    }
    this.handlers
      .get(messageType)!
      .set(handlerId, handler as MessageHandler<any>);

    // Track and send subscription
    const topicList = typeof topics === "string" ? [topics] : topics;
    const newTopics: string[] = [];
    for (const t of topicList) {
      if (!this.subscribedTopics.has(t)) {
        this.subscribedTopics.add(t);
        newTopics.push(t);
      }
    }
    if (newTopics.length > 0 && this.isConnected) {
      this.send({ t: "Subscribe", c: { topics: newTopics } });
    }
  }

  /**
   * Unsubscribe from topics and remove a handler.
   */
  unsubscribe<T extends WebSocketMessageType>(
    messageType: T,
    topics: string | string[],
    handlerId: string,
  ): void {
    const handlerMap = this.handlers.get(messageType);
    if (handlerMap) {
      handlerMap.delete(handlerId);
      if (handlerMap.size === 0) this.handlers.delete(messageType);
    }

    const topicList = typeof topics === "string" ? [topics] : topics;
    for (const topic of topicList) {
      this.subscribedTopics.delete(topic);
      if (this.isConnected) {
        this.send({ t: "Unsubscribe", c: { topic } });
      }
    }
  }

  /**
   * Register a handler for a message type without subscribing to any topic.
   * Useful for messages that arrive on already-subscribed topics.
   */
  on<T extends WebSocketMessageType>(
    messageType: T,
    handler: (content: WebSocketMessageContent<T>) => void,
    handlerId: string,
  ): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Map());
    }
    this.handlers
      .get(messageType)!
      .set(handlerId, handler as MessageHandler<any>);
  }

  /** Remove a specific handler by type and ID. */
  off(messageType: WebSocketMessageType, handlerId: string): void {
    const handlerMap = this.handlers.get(messageType);
    if (handlerMap) {
      handlerMap.delete(handlerId);
      if (handlerMap.size === 0) this.handlers.delete(messageType);
    }
  }

  /** List currently subscribed topic strings. */
  getSubscribedTopics(): string[] {
    return [...this.subscribedTopics];
  }

  /** Request the server to list our subscribed topics. */
  listServerTopics(): void {
    if (this.isConnected) {
      this.send({ t: "ListSubscribedTopics" });
    }
  }

  // ─── Internals ───────────────────────────────────────────────

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(event: MessageEvent): void {
    let message: WebSocketMessage | undefined;
    try {
      if (typeof event.data === "string") {
        message = JSON.parse(event.data) as WebSocketMessage;
      }
      // For MessagePack/binary, users should bring their own decoder
      // and set onRawMessage or override handleMessage.
    } catch {
      return;
    }
    if (!message || !message.t) return;

    this.onRawMessage?.(message);

    const handlerMap = this.handlers.get(message.t);
    if (handlerMap) {
      const content = "c" in message ? (message as any).c : undefined;
      for (const handler of handlerMap.values()) {
        try {
          handler(content);
        } catch {
          /* user handler error */
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (
      this.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }
}

export default BitcraftApiClient;
