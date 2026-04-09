/**
 * Server-side BitJita API helpers for Convex actions.
 * These call the BitJita API directly (no caching — Convex actions are ephemeral).
 */

const BASE_URL = "https://bitjita.com";
const TIMEOUT = 15_000;

/**
 * Fetch JSON from BitJita with BigInt-safe parsing.
 */
export async function fetchBitJita<T = any>(
  path: string,
  options?: { method?: string; body?: string },
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const signal = AbortSignal.timeout(TIMEOUT);
  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: { Accept: "application/json" },
    body: options?.body,
    signal,
  });
  if (!res.ok) throw new Error(`BitJita ${res.status}: ${url}`);
  const text = await res.text();
  return bigIntSafeParse(text) as T;
}

/**
 * POST JSON to BitJita.
 */
export async function postBitJita<T = any>(
  path: string,
  body: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`BitJita POST ${res.status}: ${url}`);
    const text = await res.text();
    return bigIntSafeParse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse JSON with BigInt-safe number handling.
 * Uses the ES2025 3-arg reviver to convert unsafe integers to strings.
 */
function bigIntSafeParse(text: string): unknown {
  return (JSON.parse as any)(
    text,
    (_key: string, value: unknown, ctx: { source: string }) => {
      if (
        typeof value === "number" &&
        !ctx.source.includes(".") &&
        !Number.isSafeInteger(value)
      ) {
        return ctx.source;
      }
      return value;
    },
  );
}

// ─── Typed API Helpers ──────────────────────────────────────────────────────

export const ORDUM_EMPIRE_ID = "379564";

export function getEmpire(id: string) {
  return fetchBitJita<any>(`/api/empires/${id}`);
}
export function getEmpireClaims(id: string) {
  return fetchBitJita<any>(`/api/empires/${id}/claims`);
}
export function getClaim(id: string) {
  return fetchBitJita<any>(`/api/claims/${id}`);
}
export function getClaimBuildings(id: string) {
  return fetchBitJita<any>(`/api/claims/${id}/buildings`);
}
export function getClaimInventories(id: string) {
  return fetchBitJita<any>(`/api/claims/${id}/inventories`);
}
export function getClaimMembers(id: string) {
  return fetchBitJita<any>(`/api/claims/${id}/members`);
}
export function getClaimConstruction(id: string) {
  return fetchBitJita<any>(`/api/claims/${id}/construction`);
}
export function getPlayerBuffs(id: string) {
  return fetchBitJita<any>(`/api/players/${id}/buffs`);
}
export function getPlayerInventories(id: string) {
  return fetchBitJita<any>(`/api/players/${id}/inventories`);
}
export function getPlayerTravelerTasks(id: string) {
  return fetchBitJita<any>(`/api/players/${id}/traveler-tasks`);
}
export function getPlayerPassiveCrafts(id: string) {
  return fetchBitJita<any>(`/api/players/${id}/passive-crafts`);
}
export function listPlayers(params: { q: string }) {
  return fetchBitJita<any>(`/api/players?q=${encodeURIComponent(params.q)}`);
}
export function getPlayer(id: string) {
  return fetchBitJita<any>(`/api/players/${id}`);
}
export function listCrafts(params: {
  playerEntityId?: string;
  claimId?: string;
  completed?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.playerEntityId)
    searchParams.set("playerEntityId", params.playerEntityId);
  if (params.claimId) searchParams.set("claimId", params.claimId);
  if (params.completed !== undefined)
    searchParams.set("completed", String(params.completed));
  return fetchBitJita<any>(`/api/crafts?${searchParams}`);
}
export function getLogsStorage(params: {
  buildingEntityId?: string;
  playerEntityId?: string;
  limit: number;
  afterId?: string;
}) {
  const searchParams = new URLSearchParams({ limit: String(params.limit) });
  if (params.buildingEntityId)
    searchParams.set("buildingEntityId", params.buildingEntityId);
  if (params.playerEntityId)
    searchParams.set("playerEntityId", params.playerEntityId);
  if (params.afterId) searchParams.set("afterId", params.afterId);
  return fetchBitJita<any>(`/api/logs/storage?${searchParams}`);
}
export function postMarketPricesBulk(body: {
  itemIds?: number[];
  cargoIds?: number[];
}) {
  return postBitJita<any>("/api/market/prices/bulk", body);
}
