/**
 * Server-side BitJita API helpers for Convex actions.
 * These call the BitJita API directly (no caching — Convex actions are ephemeral).
 */
const BASE_URL = "https://bitjita.com";
const TIMEOUT = 15_000;
/**
 * Fetch JSON from BitJita with BigInt-safe parsing.
 */
export async function fetchBitJita(path, options) {
    const url = `${BASE_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            method: options?.method ?? "GET",
            headers: { Accept: "application/json" },
            body: options?.body,
            signal: controller.signal,
        });
        if (!res.ok)
            throw new Error(`BitJita ${res.status}: ${url}`);
        const text = await res.text();
        return bigIntSafeParse(text);
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * POST JSON to BitJita.
 */
export async function postBitJita(path, body) {
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
        if (!res.ok)
            throw new Error(`BitJita POST ${res.status}: ${url}`);
        const text = await res.text();
        return bigIntSafeParse(text);
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Parse JSON with BigInt-safe number handling.
 * Uses the ES2025 3-arg reviver to convert unsafe integers to strings.
 */
function bigIntSafeParse(text) {
    // @ts-ignore ES2025 3-arg JSON.parse reviver
    return JSON.parse(text, (_key, value, ctx) => {
        if (typeof value === "number" &&
            !ctx.source.includes(".") &&
            !Number.isSafeInteger(value)) {
            return ctx.source;
        }
        return value;
    });
}
// ─── Typed API Helpers ──────────────────────────────────────────────────────
export const ORDUM_EMPIRE_ID = "1224979098644868393";
export function getEmpire(id) {
    return fetchBitJita(`/api/empire/${id}`);
}
export function getEmpireClaims(id) {
    return fetchBitJita(`/api/empire/${id}/claims`);
}
export function getClaim(id) {
    return fetchBitJita(`/api/claim/${id}`);
}
export function getClaimBuildings(id) {
    return fetchBitJita(`/api/claim/${id}/buildings`);
}
export function getClaimInventories(id) {
    return fetchBitJita(`/api/claim/${id}/inventories`);
}
export function getClaimMembers(id) {
    return fetchBitJita(`/api/claim/${id}/members`);
}
export function getClaimConstruction(id) {
    return fetchBitJita(`/api/claim/${id}/construction`);
}
export function getPlayerBuffs(id) {
    return fetchBitJita(`/api/player/${id}/buffs`);
}
export function getPlayerInventories(id) {
    return fetchBitJita(`/api/player/${id}/inventories`);
}
export function getPlayerTravelerTasks(id) {
    return fetchBitJita(`/api/player/${id}/traveler-tasks`);
}
export function getPlayerPassiveCrafts(id) {
    return fetchBitJita(`/api/player/${id}/passive-crafts`);
}
export function listPlayers(params) {
    return fetchBitJita(`/api/players?q=${encodeURIComponent(params.q)}`);
}
export function getPlayer(id) {
    return fetchBitJita(`/api/player/${id}`);
}
export function listCrafts(params) {
    const searchParams = new URLSearchParams();
    if (params.playerEntityId)
        searchParams.set("playerEntityId", params.playerEntityId);
    if (params.claimId)
        searchParams.set("claimId", params.claimId);
    if (params.completed !== undefined)
        searchParams.set("completed", String(params.completed));
    return fetchBitJita(`/api/crafts?${searchParams}`);
}
export function getLogsStorage(params) {
    const searchParams = new URLSearchParams({ limit: String(params.limit) });
    if (params.buildingEntityId)
        searchParams.set("buildingEntityId", params.buildingEntityId);
    if (params.playerEntityId)
        searchParams.set("playerEntityId", params.playerEntityId);
    if (params.afterId)
        searchParams.set("afterId", params.afterId);
    return fetchBitJita(`/api/logs/storage?${searchParams}`);
}
export function postMarketPricesBulk(body) {
    return postBitJita("/api/market/prices/bulk", body);
}
