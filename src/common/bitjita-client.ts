/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BitJita API Client — Auto-generated
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Source: https://bitjita.com/docs/api
 * Generated: 2026-03-14T16:13:14.779Z
 *
 * Re-generate with:
 *   bun run scripts/generate-bitjita-client.ts
 *
 * Usage:
 *   import { BitJitaClient } from "./bitjita-client";
 *   const client = new BitJitaClient("https://bitjita.com");
 *   const claims = await client.listClaims({ q: "ordum" });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PostAuthChatValidateResponse {
  success: boolean;
  player: { entityId: string; username: string };
  verificationCode: string;
  verifiedAt: string;
  [key: string]: unknown;
}

export interface BuildingsResponse {
  buildings: unknown[];
  [key: string]: unknown;
}

export interface BuildingResponse {
  building: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CargoListResponse {
  cargos: unknown[];
  count: number;
  [key: string]: unknown;
}

export interface CargoResponse {
  cargo: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChatResponse {
  messages: unknown[];
  total: number;
  [key: string]: unknown;
}

export interface ClaimsResponse {
  claims: unknown[];
  count: number;
  [key: string]: unknown;
}

export interface ClaimResponse {
  claim: {
    entityId: string;
    ownerPlayerEntityId: string;
    ownerBuildingEntityId: string;
    name: string;
    neutral: boolean;
    regionId: number;
    regionName: string;
    supplies: number;
    buildingMaintenance: number;
    numTiles: number;
    locationX: number;
    locationZ: number;
    locationDimension: number;
    treasury: string;
    ownerPlayerUsername: string;
    techResearching: number;
    techStartTimestamp: string;
    tileCost: number;
    upkeepCost: number;
    suppliesRunOut: number;
    tier: number;
    researchedTechs: unknown[];
  };
  [key: string]: unknown;
}

export type ClaimBuildingsResponse = unknown;

export interface ClaimCitizensResponse {
  citizens: unknown[];
  count: number;
  skillNames: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ClaimConstructionResponse {
  projects: unknown[];
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface ClaimInventoriesResponse {
  buildings: unknown[];
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface ClaimLayoutResponse {
  version: number;
  name: string;
  placements: unknown[];
  buildings: unknown[];
  tiles: unknown[];
  mapMetadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ClaimMembersResponse {
  members: unknown[];
  count: number;
  [key: string]: unknown;
}

export interface ClaimRecruitmentResponse {
  recruitment: unknown[];
  count: number;
  [key: string]: unknown;
}

export interface ClaimResearchResponse {
  technologies: unknown[];
  [key: string]: unknown;
}

export interface CraftsResponse {
  craftResults: unknown[];
  items: unknown[];
  cargos: unknown[];
  claims: unknown[];
  [key: string]: unknown;
}

export interface CraftResponse {
  craft: Record<string, unknown>;
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface CraftContributionsResponse {
  contributions: unknown[];
  [key: string]: unknown;
}

export interface CreaturesResponse {
  creatures: unknown[];
  count: number;
  metrics: {
    totalCreatures: number;
    totalTags: number;
    huntableCreatures: number;
    averageTier: number;
  };
  [key: string]: unknown;
}

export interface CreatureResponse {
  creature: {
    enemyType: number;
    name: string;
    description: string;
    tier: number;
    tag: string;
    rarityStr: string;
    huntable: boolean;
    maxHealth: number;
    minDamage: number;
    maxDamage: number;
    armor: number;
    accuracy: number;
    evasion: number;
    strength: number;
  };
  [key: string]: unknown;
}

export interface DeployablesResponse {
  deployables: unknown[];
  count: number;
  metrics: {
    totalDeployables: number;
    totalTypes: number;
    landMounts: number;
    waterMounts: number;
    withStorage: number;
  };
  [key: string]: unknown;
}

export interface DeployableResponse {
  deployable: {
    id: number;
    name: string;
    deployableTypeName: string;
    movementTypeName: string;
    speed: unknown[];
    capacity: number;
    storage: number;
    stats: unknown[];
    pathfinding: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface EmpiresResponse {
  empires: unknown[];
  totalClaims: number;
  totalMembers: number;
  totalTreasury: string;
  count: number;
  [key: string]: unknown;
}

export interface EmpireResponse {
  empire: Record<string, unknown>;
  members: unknown[];
  [key: string]: unknown;
}

export interface EmpireClaimsResponse {
  claims: unknown[];
  count: number;
  [key: string]: unknown;
}

export type EmpireTowersResponse = unknown;

export interface FoodListResponse {
  food: unknown[];
  count: number;
  metrics: {
    totalFood: number;
    consumableInCombat: number;
    withBuffs: number;
    withHpRestore: number;
    withStaminaRestore: number;
    withTeleportEnergy: number;
  };
  [key: string]: unknown;
}

export interface FoodResponse {
  food: {
    itemId: number;
    hp: number;
    stamina: number;
    hunger: number;
    teleportationEnergy: number;
    consumableWhileInCombat: boolean;
    buffs: unknown[];
    itemName: string;
    iconAssetName: string;
    tier: number;
    rarityStr: string;
  };
  [key: string]: unknown;
}

export interface HexiteExchangeResponse {
  entries: unknown[];
  events: unknown[];
  metrics: {
    totalPackages: number;
    bestValueId: number;
    maxBonusPercentage: number;
  };
  [key: string]: unknown;
}

export interface HexiteExchangeHistoryResponse {
  historyData: unknown[];
  [key: string]: unknown;
}

export interface ItemsResponse {
  items: unknown[];
  metrics: { totalItems: number; totalCategories: number };
  [key: string]: unknown;
}

export interface ItemResponse {
  item: Record<string, unknown>;
  craftingRecipes: unknown[];
  extractionRecipes: unknown[];
  relatedSkills: unknown[];
  marketStats: Record<string, unknown>;
  recipesUsingItem: unknown[];
  itemListPossibilities: unknown[];
  [key: string]: unknown;
}

export interface LeaderboardCargoResponse {
  item: Record<string, unknown>;
  summary: {
    totalHolders: number;
    totalQuantity: number;
    averagePerHolder: number;
  };
  holdings: unknown[];
  [key: string]: unknown;
}

export interface LeaderboardExplorationResponse {
  players: unknown[];
  count: number;
  totalChunks: number;
  regionCount: number;
  chunksPerRegion: number;
  globalStats: Record<string, unknown>;
  pagination: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LeaderboardItemsResponse {
  item: Record<string, unknown>;
  summary: {
    totalHolders: number;
    totalQuantity: number;
    averagePerHolder: number;
  };
  holdings: unknown[];
  [key: string]: unknown;
}

export interface LeaderboardPlaytimeResponse {
  players: unknown[];
  count: number;
  globalStats: {
    maxTimePlayed: number;
    totalTimePlayed: number;
    averageTimePlayed: number;
  };
  pagination: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LeaderboardSkillsResponse {
  players: unknown[];
  count: number;
  skillNames: Record<string, unknown>;
  totalSkills: number;
  globalHighestLevel: number;
  pagination: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StorageLogsResponse {
  logs: unknown[];
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface MarketResponse {
  data: {
    items: unknown[];
    categories: unknown[];
    metrics: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface MarketItemResponse {
  item: Record<string, unknown>;
  sellOrders: unknown[];
  buyOrders: unknown[];
  stats: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MarketPriceHistoryResponse {
  priceData: unknown[];
  priceStats: {
    avg24h?: number;
    avg7d?: number;
    avg30d?: number;
    allTimeHigh?: number;
    allTimeLow?: number;
    priceChange24h?: number;
    priceChange7d?: number;
    totalTrades: number;
    totalVolume: number;
  };
  recentTrades: unknown[];
  [key: string]: unknown;
}

export interface MarketDealsResponse {
  arbitrage: unknown[];
  [key: string]: unknown;
}

export interface MarketPlayerResponse {
  playerId: string;
  playerUsername: string;
  sellOrders: unknown[];
  buyOrders: unknown[];
  [key: string]: unknown;
}

export interface MarketPlayerHistoryResponse {
  playerId: string;
  playerUsername: string;
  sellOrderHistory: unknown[];
  buyOrderHistory: unknown[];
  totalSellOrders: number;
  totalBuyOrders: number;
  [key: string]: unknown;
}

export interface MarketPlayerTradesResponse {
  trades: unknown[];
  [key: string]: unknown;
}

export interface PostMarketPricesBulkResponse {
  data: { items: Record<string, unknown>; cargo: Record<string, unknown> };
  [key: string]: unknown;
}

export interface PlayersResponse {
  players: unknown[];
  total: number;
  [key: string]: unknown;
}

export interface PlayerResponse {
  player: Record<string, unknown>;
  claims: unknown[];
  empires: unknown[];
  marketOrders: unknown[];
  skills: unknown[];
  [key: string]: unknown;
}

export interface PlayerBuffsResponse {
  buffs: unknown[];
  count: number;
  isOnline: boolean;
  [key: string]: unknown;
}

export interface PlayerCraftsResponse {
  crafts: unknown[];
  [key: string]: unknown;
}

export interface PlayerEquipmentResponse {
  equipment: unknown[];
  [key: string]: unknown;
}

export interface PlayerExplorationResponse {
  bitmap: string;
  exploredChunksCount: number;
  regions: unknown[];
  meta: { totalChunks: number; regionCount: number; chunksPerRegion: number };
  [key: string]: unknown;
}

export type PlayerHousingResponse = unknown;

export interface PlayerHousingDetailResponse {
  buildingEntityId: string;
  buildingName: string;
  playerEntityId: string;
  rank: number;
  lockedUntil: string;
  isEmpty: boolean;
  regionId: number;
  entranceDimensionId: number;
  claimName: string;
  claimRegionId: number;
  claimEntityId: string;
  locationX: number;
  locationZ: number;
  locationDimension: number;
  inventories: unknown[];
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface PlayerInventoriesResponse {
  inventories: unknown[];
  items: unknown[];
  cargos: unknown[];
  [key: string]: unknown;
}

export interface PlayerMarketResponse {
  sellOrders: unknown[];
  buyOrders: unknown[];
  [key: string]: unknown;
}

export interface PlayerMarketCollectionsResponse {
  collections: unknown[];
  total: number;
  [key: string]: unknown;
}

export interface PlayerPassiveCraftsResponse {
  craftResults: unknown[];
  items: unknown[];
  cargos: unknown[];
  count: number;
  [key: string]: unknown;
}

export interface PlayerSkillRankingsResponse {
  rankings: Record<string, unknown>;
  totalPlayers: number;
  [key: string]: unknown;
}

export interface PlayerStatsResponse {
  stats: {
    entityId: string;
    values: unknown[];
    regionId: number;
    createdAt: string;
    updatedAt: string;
  };
  [key: string]: unknown;
}

export interface PlayerTravelerTasksResponse {
  tasks: unknown[];
  items: Record<string, unknown>;
  cargo: Record<string, unknown>;
  expirationTimestamp?: number;
  [key: string]: unknown;
}

export interface PlayerVaultResponse {
  collectibles: unknown[];
  [key: string]: unknown;
}

export type RegionsResponse = unknown;

export interface RegionsStatusResponse {
  regions: unknown[];
  [key: string]: unknown;
}

export interface ResourcesResponse {
  resources: unknown[];
  count: number;
  metrics: { totalResources: number; totalTags: number };
  [key: string]: unknown;
}

export interface ResourceResponse {
  resource: {
    id: number;
    name: string;
    description: string;
    tier: number;
    tag: string;
    rarity: number;
    max_health: number;
    scheduled_respawn_time: number;
  };
  [key: string]: unknown;
}

export interface SkillsResponse {
  profession: unknown[];
  adventure: unknown[];
  [key: string]: unknown;
}

export interface StatsHexcoinResponse {
  buckets: unknown[];
  [key: string]: unknown;
}

export interface StatsSkillsResponse {
  skillStats: unknown[];
  summary: {
    totalPlayers: number;
    totalSkills: number;
    totalXPAllSkills: number;
  };
  [key: string]: unknown;
}

export interface StatsTradeVolumeResponse {
  buckets: unknown[];
  items: unknown[];
  overall: Record<string, unknown>;
  regions: unknown[];
  selectedRegionId?: number;
  [key: string]: unknown;
}

export interface StatusResponse {
  regions: unknown[];
  count: number;
  totalSignedIn: number;
  totalInQueue: number;
  [key: string]: unknown;
}

export interface StatusChartResponse {
  count: number;
  buckets: unknown[];
  [key: string]: unknown;
}

export interface StatusDauMauResponse {
  count: number;
  buckets: unknown[];
  current: {
    dau: number;
    mau: number;
    dauTiers: Record<string, unknown>;
    mauTiers: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface WindResponse {
  params: unknown[];
  debug: unknown[];
  [key: string]: unknown;
}

export type ExperienceLevelsCsvResponse = string;

export interface ExperienceLevelsJsonResponse {
  level: number;
  xp: number;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Client Error
// ═══════════════════════════════════════════════════════════════════════════════

export class BitJitaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`BitJita API error ${status} ${statusText} for ${url}`);
    this.name = "BitJitaApiError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Client Options
// ═══════════════════════════════════════════════════════════════════════════════

export interface BitJitaClientOptions {
  /** Base URL of the BitJita API server. Default: "https://bitjita.com". No trailing slash. */
  baseUrl?: string;
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

export class BitJitaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;

  constructor(options?: string | BitJitaClientOptions) {
    if (typeof options === "string") {
      this.baseUrl = options.replace(/\/+$/, "");
      this.fetchFn = globalThis.fetch.bind(globalThis);
      this.defaultHeaders = {};
      this.timeout = 30_000;
    } else {
      this.baseUrl = (options?.baseUrl ?? "https://bitjita.com").replace(
        /\/+$/,
        "",
      );
      this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
      this.defaultHeaders = options?.headers ?? {};
      this.timeout = options?.timeout ?? 30_000;
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
        throw new BitJitaApiError(
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

  protected async requestPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...this.defaultHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const respBody = await response.text().catch(() => "");
        throw new BitJitaApiError(
          response.status,
          response.statusText,
          respBody,
          url,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── API Methods (77 endpoints) ─────────────────────────────

  /**
   * `POST /api/auth/chat/validate`
   *
   * Verify player identity by validating a code posted in-game chat
   */
  async postAuthChatValidate(body: {
    code: string;
  }): Promise<PostAuthChatValidateResponse> {
    return this.requestPost<PostAuthChatValidateResponse>(
      "/api/auth/chat/validate",
      body,
    );
  }

  /**
   * `GET /api/buildings`
   *
   * Get building information and details
   */
  async listBuildings(): Promise<BuildingsResponse> {
    return this.request<BuildingsResponse>("/api/buildings");
  }

  /**
   * `GET /api/buildings/[id]`
   *
   * Get detailed information about a specific building
   */
  async getBuilding(id: string): Promise<BuildingResponse> {
    return this.request<BuildingResponse>(`/api/buildings/${id}`);
  }

  /**
   * `GET /api/cargo`
   *
   * Get cargo information and details with optional search
   */
  async listCargo(params?: { q?: string }): Promise<CargoListResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<CargoListResponse>("/api/cargo" + query);
  }

  /**
   * `GET /api/cargo/[id]`
   *
   * Get detailed information about a specific cargo
   */
  async getCargo(id: number): Promise<CargoResponse> {
    return this.request<CargoResponse>(`/api/cargo/${id}`);
  }

  /**
   * `GET /api/chat`
   *
   * Get chat messages with filtering
   */
  async getChat(params?: {
    limit?: number;
    since?: string;
  }): Promise<ChatResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ChatResponse>("/api/chat" + query);
  }

  /**
   * `GET /api/claims`
   *
   * Get claim information with search, pagination, and sorting
   */
  async listClaims(params?: {
    q?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
    regionId?: number;
  }): Promise<ClaimsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ClaimsResponse>("/api/claims" + query);
  }

  /**
   * `GET /api/claims/[id]`
   *
   * Get detailed information about a specific claim
   */
  async getClaim(id: string): Promise<ClaimResponse> {
    return this.request<ClaimResponse>(`/api/claims/${id}`);
  }

  /**
   * `GET /api/claims/[id]/buildings`
   *
   * Get buildings for a specific claim
   */
  async getClaimBuildings(id: string): Promise<ClaimBuildingsResponse> {
    return this.request<ClaimBuildingsResponse>(`/api/claims/${id}/buildings`);
  }

  /**
   * `GET /api/claims/[id]/citizens`
   *
   * Get citizens for a specific claim
   */
  async getClaimCitizens(id: string): Promise<ClaimCitizensResponse> {
    return this.request<ClaimCitizensResponse>(`/api/claims/${id}/citizens`);
  }

  /**
   * `GET /api/claims/[id]/construction`
   *
   * Get active construction projects for a claim
   */
  async getClaimConstruction(id: string): Promise<ClaimConstructionResponse> {
    return this.request<ClaimConstructionResponse>(
      `/api/claims/${id}/construction`,
    );
  }

  /**
   * `GET /api/claims/[id]/inventories`
   *
   * Get inventories for a specific claim
   */
  async getClaimInventories(id: string): Promise<ClaimInventoriesResponse> {
    return this.request<ClaimInventoriesResponse>(
      `/api/claims/${id}/inventories`,
    );
  }

  /**
   * `GET /api/claims/[id]/layout`
   *
   * Get building layout and placements for a claim with hex coordinates
   */
  async getClaimLayout(id: string): Promise<ClaimLayoutResponse> {
    return this.request<ClaimLayoutResponse>(`/api/claims/${id}/layout`);
  }

  /**
   * `GET /api/claims/[id]/members`
   *
   * Get members for a specific claim
   */
  async getClaimMembers(id: string): Promise<ClaimMembersResponse> {
    return this.request<ClaimMembersResponse>(`/api/claims/${id}/members`);
  }

  /**
   * `GET /api/claims/[id]/recruitment`
   *
   * Get recruitment listings for a specific claim
   */
  async getClaimRecruitment(id: string): Promise<ClaimRecruitmentResponse> {
    return this.request<ClaimRecruitmentResponse>(
      `/api/claims/${id}/recruitment`,
    );
  }

  /**
   * `GET /api/claims/[id]/research`
   *
   * Get all available technologies and which ones the claim has researched
   */
  async getClaimResearch(id: string): Promise<ClaimResearchResponse> {
    return this.request<ClaimResearchResponse>(`/api/claims/${id}/research`);
  }

  /**
   * `GET /api/crafts`
   *
   * Get public crafting activities with filtering options
   */
  async listCrafts(params?: {
    claimEntityId?: string;
    playerEntityId?: string;
    regionId?: number;
    completed?: boolean;
    skillId?: number;
  }): Promise<CraftsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<CraftsResponse>("/api/crafts" + query);
  }

  /**
   * `GET /api/crafts/[craftId]`
   *
   * Get detailed information about a specific craft
   */
  async getCraft(craftId: string): Promise<CraftResponse> {
    return this.request<CraftResponse>(`/api/crafts/${craftId}`);
  }

  /**
   * `GET /api/crafts/[craftId]/contributions`
   *
   * Get all contributors to a crafting project ranked by progress contributed
   */
  async getCraftContributions(
    craftId: string,
  ): Promise<CraftContributionsResponse> {
    return this.request<CraftContributionsResponse>(
      `/api/crafts/${craftId}/contributions`,
    );
  }

  /**
   * `GET /api/creatures`
   *
   * Get all creatures with optional search filtering
   */
  async listCreatures(params?: { q?: string }): Promise<CreaturesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<CreaturesResponse>("/api/creatures" + query);
  }

  /**
   * `GET /api/creatures/[id]`
   *
   * Get detailed information about a specific creature
   */
  async getCreature(id: number): Promise<CreatureResponse> {
    return this.request<CreatureResponse>(`/api/creatures/${id}`);
  }

  /**
   * `GET /api/deployables`
   *
   * Get all deployables (mounts, carts, boats) with optional search
   */
  async listDeployables(params?: { q?: string }): Promise<DeployablesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<DeployablesResponse>("/api/deployables" + query);
  }

  /**
   * `GET /api/deployables/[id]`
   *
   * Get detailed deployable information including pathfinding, stats, and terrain-specific speed data
   */
  async getDeployable(id: number): Promise<DeployableResponse> {
    return this.request<DeployableResponse>(`/api/deployables/${id}`);
  }

  /**
   * `GET /api/empires`
   *
   * Get empire information with optional search
   */
  async listEmpires(params?: { q?: string }): Promise<EmpiresResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<EmpiresResponse>("/api/empires" + query);
  }

  /**
   * `GET /api/empires/[id]`
   *
   * Get detailed information about a specific empire
   */
  async getEmpire(id: string): Promise<EmpireResponse> {
    return this.request<EmpireResponse>(`/api/empires/${id}`);
  }

  /**
   * `GET /api/empires/[id]/claims`
   *
   * Get all claims belonging to an empire with supply levels and upkeep costs
   */
  async getEmpireClaims(id: string): Promise<EmpireClaimsResponse> {
    return this.request<EmpireClaimsResponse>(`/api/empires/${id}/claims`);
  }

  /**
   * `GET /api/empires/[id]/towers`
   *
   * Get towers for a specific empire
   */
  async getEmpireTowers(id: string): Promise<EmpireTowersResponse> {
    return this.request<EmpireTowersResponse>(`/api/empires/${id}/towers`);
  }

  /**
   * `GET /api/food`
   *
   * Get all food items with nutritional data and buff effects
   */
  async listFood(params?: { q?: string }): Promise<FoodListResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<FoodListResponse>("/api/food" + query);
  }

  /**
   * `GET /api/food/[itemId]`
   *
   * Get detailed food item information including all buffs with stat modifiers
   */
  async getFood(itemId: number): Promise<FoodResponse> {
    return this.request<FoodResponse>(`/api/food/${itemId}`);
  }

  /**
   * `GET /api/hexite-exchange`
   *
   * Get hexite packages with calculated value metrics
   */
  async getHexiteExchange(params?: {
    eventName?: string;
  }): Promise<HexiteExchangeResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<HexiteExchangeResponse>("/api/hexite-exchange" + query);
  }

  /**
   * `GET /api/hexite-exchange/history`
   *
   * Get historical hexite exchange data with time-based aggregation
   */
  async getHexiteExchangeHistory(params?: {
    bucket?: string;
    entryId?: number;
    eventName?: string;
    limit?: number;
  }): Promise<HexiteExchangeHistoryResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<HexiteExchangeHistoryResponse>(
      "/api/hexite-exchange/history" + query,
    );
  }

  /**
   * `GET /api/items`
   *
   * Get item catalog and search items
   */
  async listItems(params?: { q?: string }): Promise<ItemsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ItemsResponse>("/api/items" + query);
  }

  /**
   * `GET /api/items/[itemId]`
   *
   * Get detailed information about a specific item including recipes and market data
   */
  async getItem(itemId: number): Promise<ItemResponse> {
    return this.request<ItemResponse>(`/api/items/${itemId}`);
  }

  /**
   * `GET /api/leaderboard/cargo/[cargoId]`
   *
   * Get top 2000 cargo holders ranked by quantity with storage breakdown
   */
  async getLeaderboardCargo(
    cargoId: number,
  ): Promise<LeaderboardCargoResponse> {
    return this.request<LeaderboardCargoResponse>(
      `/api/leaderboard/cargo/${cargoId}`,
    );
  }

  /**
   * `GET /api/leaderboard/exploration`
   *
   * Get exploration leaderboard with pagination and sorting
   */
  async getLeaderboardExploration(params?: {
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
  }): Promise<LeaderboardExplorationResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<LeaderboardExplorationResponse>(
      "/api/leaderboard/exploration" + query,
    );
  }

  /**
   * `GET /api/leaderboard/items/[itemId]`
   *
   * Get top 2000 item holders ranked by quantity with storage breakdown
   */
  async getLeaderboardItem(itemId: number): Promise<LeaderboardItemsResponse> {
    return this.request<LeaderboardItemsResponse>(
      `/api/leaderboard/items/${itemId}`,
    );
  }

  /**
   * `GET /api/leaderboard/playtime`
   *
   * Get playtime leaderboard with sorting, searching, and global statistics
   */
  async getLeaderboardPlaytime(params?: {
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<LeaderboardPlaytimeResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<LeaderboardPlaytimeResponse>(
      "/api/leaderboard/playtime" + query,
    );
  }

  /**
   * `GET /api/leaderboard/skills`
   *
   * Get skills leaderboard with pagination and sorting
   */
  async listLeaderboardSkills(params?: {
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
    regionId?: number;
  }): Promise<LeaderboardSkillsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<LeaderboardSkillsResponse>(
      "/api/leaderboard/skills" + query,
    );
  }

  /**
   * `GET /api/logs/storage`
   *
   * Get storage logs for players, buildings, or specific inventory history
   */
  async getLogsStorage(params?: {
    playerEntityId?: string;
    buildingEntityId?: string;
    limit?: number;
    afterId?: string;
    since?: string;
  }): Promise<StorageLogsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<StorageLogsResponse>("/api/logs/storage" + query);
  }

  /**
   * `GET /api/market`
   *
   * Get market items, orders, and categories
   */
  async getMarket(params?: {
    q?: string;
    category?: string;
    hasOrders?: boolean;
    hasSellOrders?: boolean;
    hasBuyOrders?: boolean;
    claimEntityId?: string;
  }): Promise<MarketResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<MarketResponse>("/api/market" + query);
  }

  /**
   * `GET /api/market/[itemOrCargo]/[itemId]`
   *
   * Get market details for a specific item or cargo
   */
  async getMarketById(
    itemOrCargo: string,
    itemId: number,
    params?: {
      claimEntityId?: string;
    },
  ): Promise<MarketItemResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<MarketItemResponse>(
      `/api/market/${itemOrCargo}/${itemId}` + query,
    );
  }

  /**
   * `GET /api/market/[itemOrCargo]/[itemId]/price-history`
   *
   * Get price history with VWAP chart data and statistics
   */
  async getMarketPriceHistory(
    itemOrCargo: string,
    itemId: number,
    params?: {
      bucket?: string;
      limit?: number;
      regionId?: number;
    },
  ): Promise<MarketPriceHistoryResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<MarketPriceHistoryResponse>(
      `/api/market/${itemOrCargo}/${itemId}/price-history` + query,
    );
  }

  /**
   * `GET /api/market/deals`
   *
   * Get arbitrage opportunities and market deals
   */
  async getMarketDeals(): Promise<MarketDealsResponse> {
    return this.request<MarketDealsResponse>("/api/market/deals");
  }

  /**
   * `GET /api/market/player/[playerId]`
   *
   * Get all market orders for a specific player
   */
  async getMarketPlayer(playerId: string): Promise<MarketPlayerResponse> {
    return this.request<MarketPlayerResponse>(`/api/market/player/${playerId}`);
  }

  /**
   * `GET /api/market/player/[playerId]/history`
   *
   * Get market order history for a specific player
   */
  async getMarketPlayerHistory(
    playerId: string,
    params?: {
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<MarketPlayerHistoryResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<MarketPlayerHistoryResponse>(
      `/api/market/player/${playerId}/history` + query,
    );
  }

  /**
   * `GET /api/market/player/[playerId]/trades`
   *
   * Get completed trades for a specific player
   */
  async getMarketPlayerTrades(
    playerId: string,
    params?: {
      type?: string;
      limit?: number;
      offset?: number;
      orderEntityId?: string;
      itemId?: number;
      itemType?: number;
    },
  ): Promise<MarketPlayerTradesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<MarketPlayerTradesResponse>(
      `/api/market/player/${playerId}/trades` + query,
    );
  }

  /**
   * `POST /api/market/prices/bulk`
   *
   * Get market price summaries for multiple items and/or cargo
   */
  async postMarketPricesBulk(body: {
    itemIds?: number[];
    cargoIds?: number[];
  }): Promise<PostMarketPricesBulkResponse> {
    return this.requestPost<PostMarketPricesBulkResponse>(
      "/api/market/prices/bulk",
      body,
    );
  }

  /**
   * `GET /api/players`
   *
   * Search for players by username
   */
  async listPlayers(params: { q: string }): Promise<PlayersResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<PlayersResponse>("/api/players" + query);
  }

  /**
   * `GET /api/players/[id]`
   *
   * Get detailed information about a specific player
   */
  async getPlayer(id: string): Promise<PlayerResponse> {
    return this.request<PlayerResponse>(`/api/players/${id}`);
  }

  /**
   * `GET /api/players/[id]/buffs`
   *
   * Get active buffs for a player with status and time remaining
   */
  async getPlayerBuffs(id: string): Promise<PlayerBuffsResponse> {
    return this.request<PlayerBuffsResponse>(`/api/players/${id}/buffs`);
  }

  /**
   * `GET /api/players/[id]/crafts`
   *
   * Get crafting activities for a specific player
   */
  async getPlayerCrafts(
    id: string,
    params?: {
      completed?: string;
    },
  ): Promise<PlayerCraftsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<PlayerCraftsResponse>(
      `/api/players/${id}/crafts` + query,
    );
  }

  /**
   * `GET /api/players/[id]/equipment`
   *
   * Get equipment information for a specific player
   */
  async getPlayerEquipment(id: string): Promise<PlayerEquipmentResponse> {
    return this.request<PlayerEquipmentResponse>(
      `/api/players/${id}/equipment`,
    );
  }

  /**
   * `GET /api/players/[id]/exploration`
   *
   * Get exploration data including discovered chunks bitmap
   */
  async getPlayerExploration(id: string): Promise<PlayerExplorationResponse> {
    return this.request<PlayerExplorationResponse>(
      `/api/players/${id}/exploration`,
    );
  }

  /**
   * `GET /api/players/[id]/housing`
   *
   * Get housing information for a specific player
   */
  async getPlayerHousing(id: string): Promise<PlayerHousingResponse> {
    return this.request<PlayerHousingResponse>(`/api/players/${id}/housing`);
  }

  /**
   * `GET /api/players/[id]/housing/[houseId]`
   *
   * Get detailed information about a specific player housing
   */
  async getPlayersHousing(
    id: string,
    houseId: string,
  ): Promise<PlayerHousingDetailResponse> {
    return this.request<PlayerHousingDetailResponse>(
      `/api/players/${id}/housing/${houseId}`,
    );
  }

  /**
   * `GET /api/players/[id]/inventories`
   *
   * Get inventory information for a specific player
   */
  async getPlayerInventories(id: string): Promise<PlayerInventoriesResponse> {
    return this.request<PlayerInventoriesResponse>(
      `/api/players/${id}/inventories`,
    );
  }

  /**
   * `GET /api/players/[id]/market`
   *
   * Get active sell and buy market orders for a player
   */
  async getPlayerMarket(id: string): Promise<PlayerMarketResponse> {
    return this.request<PlayerMarketResponse>(`/api/players/${id}/market`);
  }

  /**
   * `GET /api/players/[id]/market-collections`
   *
   * Get closed market listings (items ready for collection) for a player
   */
  async getPlayerMarketCollections(
    id: string,
  ): Promise<PlayerMarketCollectionsResponse> {
    return this.request<PlayerMarketCollectionsResponse>(
      `/api/players/${id}/market-collections`,
    );
  }

  /**
   * `GET /api/players/[id]/passive-crafts`
   *
   * Get passive crafting jobs for a player with optional status filtering
   */
  async getPlayerPassiveCrafts(
    id: string,
    params?: {
      status?: string;
    },
  ): Promise<PlayerPassiveCraftsResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<PlayerPassiveCraftsResponse>(
      `/api/players/${id}/passive-crafts` + query,
    );
  }

  /**
   * `GET /api/players/[id]/skill-rankings`
   *
   * Get skill rankings and XP data across all skills for a player
   */
  async getPlayerSkillRankings(
    id: string,
  ): Promise<PlayerSkillRankingsResponse> {
    return this.request<PlayerSkillRankingsResponse>(
      `/api/players/${id}/skill-rankings`,
    );
  }

  /**
   * `GET /api/players/[id]/stats`
   *
   * Get player character stats (health, stamina, etc.)
   */
  async getPlayerStats(id: string): Promise<PlayerStatsResponse> {
    return this.request<PlayerStatsResponse>(`/api/players/${id}/stats`);
  }

  /**
   * `GET /api/players/[id]/traveler-tasks`
   *
   * Get traveler quest tasks with required and rewarded items
   */
  async getPlayerTravelerTasks(
    id: string,
  ): Promise<PlayerTravelerTasksResponse> {
    return this.request<PlayerTravelerTasksResponse>(
      `/api/players/${id}/traveler-tasks`,
    );
  }

  /**
   * `GET /api/players/[id]/vault`
   *
   * Get vault information for a specific player
   */
  async getPlayerVault(id: string): Promise<PlayerVaultResponse> {
    return this.request<PlayerVaultResponse>(`/api/players/${id}/vault`);
  }

  /**
   * `GET /api/regions`
   *
   * Get region information and data
   */
  async listRegions(): Promise<RegionsResponse> {
    return this.request<RegionsResponse>("/api/regions");
  }

  /**
   * `GET /api/regions/status`
   *
   * Get real-time status of all game regions including player counts
   */
  async getRegionsStatus(): Promise<RegionsStatusResponse> {
    return this.request<RegionsStatusResponse>("/api/regions/status");
  }

  /**
   * `GET /api/resources`
   *
   * Get all world resources with optional search
   */
  async listResources(params?: { q?: string }): Promise<ResourcesResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<ResourcesResponse>("/api/resources" + query);
  }

  /**
   * `GET /api/resources/[resourceId]`
   *
   * Get detailed information about a specific resource
   */
  async getResource(resourceId: number): Promise<ResourceResponse> {
    return this.request<ResourceResponse>(`/api/resources/${resourceId}`);
  }

  /**
   * `GET /api/skills`
   *
   * Get all skills
   */
  async listSkills(): Promise<SkillsResponse> {
    return this.request<SkillsResponse>("/api/skills");
  }

  /**
   * `GET /api/stats/hexcoin`
   *
   * Get hexcoin circulation timeseries data
   */
  async getStatsHexcoin(params?: {
    bucket?: string;
    limit?: number;
  }): Promise<StatsHexcoinResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<StatsHexcoinResponse>("/api/stats/hexcoin" + query);
  }

  /**
   * `GET /api/stats/skills`
   *
   * Get aggregated skill experience statistics across all players
   */
  async listStatsSkills(): Promise<StatsSkillsResponse> {
    return this.request<StatsSkillsResponse>("/api/stats/skills");
  }

  /**
   * `GET /api/stats/trade-volume`
   *
   * Get trade volume timeseries data
   */
  async getStatsTradeVolume(params?: {
    bucket?: string;
    limit?: number;
    regionId?: number;
  }): Promise<StatsTradeVolumeResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<StatsTradeVolumeResponse>(
      "/api/stats/trade-volume" + query,
    );
  }

  /**
   * `GET /api/status`
   *
   * Get server population and status information
   */
  async getStatus(): Promise<StatusResponse> {
    return this.request<StatusResponse>("/api/status");
  }

  /**
   * `GET /api/status/chart`
   *
   * Get population timeseries data for charts
   */
  async getStatusChart(params?: {
    bucket?: string;
    limit?: number;
  }): Promise<StatusChartResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<StatusChartResponse>("/api/status/chart" + query);
  }

  /**
   * `GET /api/status/dau-mau`
   *
   * Get Daily/Monthly Active Users statistics
   */
  async getStatusDauMau(params?: {
    limit?: number;
  }): Promise<StatusDauMauResponse> {
    const query = params ? this.buildQuery(params) : "";
    return this.request<StatusDauMauResponse>("/api/status/dau-mau" + query);
  }

  /**
   * `GET /api/wind`
   *
   * Get wind parameters and debug configuration
   */
  async getWind(): Promise<WindResponse> {
    return this.request<WindResponse>("/api/wind");
  }

  /**
   * `GET /static/experience/levels.csv`
   *
   * Get experience level requirements in CSV format
   */
  async getExperienceLevelsCsv(): Promise<ExperienceLevelsCsvResponse> {
    return this.request<ExperienceLevelsCsvResponse>(
      "/static/experience/levels.csv",
    );
  }

  /**
   * `GET /static/experience/levels.json`
   *
   * Get experience level requirements in JSON format
   */
  async getExperienceLevelsJson(): Promise<ExperienceLevelsJsonResponse> {
    return this.request<ExperienceLevelsJsonResponse>(
      "/static/experience/levels.json",
    );
  }
}

export default BitJitaClient;
