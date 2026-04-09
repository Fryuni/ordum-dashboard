/**
 * Storage Audit Ingestion — Convex actions that call BitJita API
 * and insert logs into Convex tables.
 *
 * Migrated from src/server/storage-audit.ts ingestLogs.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import * as jita from "./lib/bitjita";
// ─── Constants ──────────────────────────────────────────────────────────────
const LOG_PAGE_SIZE = 1000;
const MAX_BUILDINGS_PER_REQUEST = 5;
const MAX_PAGES_PER_REQUEST = 5;
const BUILDING_COOLDOWN_MS = 60_000;
const PRICE_BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 50; // Convex allows more params than D1
const FIXED_VALUE = new Map([["Item:1", 1]]); // Hex Coin
const EXCLUDED_ITEMS = new Set(["Cargo:2000000"]);
// ─── Helpers ────────────────────────────────────────────────────────────────
function resolveItemName(itemType, itemId, apiItems) {
    const meta = apiItems.get(String(itemId));
    if (meta?.name)
        return meta.name;
    const normalType = itemType === "cargo" ? "Cargo" : "Item";
    return `${normalType} #${itemId}`;
}
async function getStorageBuildings(claimId) {
    const resp = await jita.getClaimBuildings(claimId);
    const buildings = (Array.isArray(resp) ? resp : (resp.buildings ?? resp));
    return buildings.filter((b) => (b.functions ?? []).some((f) => (f.storage_slots ?? 0) > 0 || (f.cargo_slots ?? 0) > 0));
}
async function fetchItemPrices(logs) {
    const prices = new Map();
    const itemIds = new Set();
    const cargoIds = new Set();
    for (const log of logs) {
        const itemType = log.data.item_type === "cargo" ? "Cargo" : "Item";
        const key = `${itemType}:${log.data.item_id}`;
        if (FIXED_VALUE.has(key)) {
            prices.set(key, FIXED_VALUE.get(key));
        }
        else if (!EXCLUDED_ITEMS.has(key)) {
            if (itemType === "Cargo")
                cargoIds.add(log.data.item_id);
            else
                itemIds.add(log.data.item_id);
        }
    }
    const allItemIds = Array.from(itemIds);
    const allCargoIds = Array.from(cargoIds);
    let iIdx = 0;
    let cIdx = 0;
    while (iIdx < allItemIds.length || cIdx < allCargoIds.length) {
        const batchItems = [];
        const batchCargo = [];
        let remaining = PRICE_BATCH_SIZE;
        const itemsToTake = Math.min(allItemIds.length - iIdx, remaining);
        batchItems.push(...allItemIds.slice(iIdx, iIdx + itemsToTake));
        iIdx += itemsToTake;
        remaining -= itemsToTake;
        if (remaining > 0) {
            const cargoToTake = Math.min(allCargoIds.length - cIdx, remaining);
            batchCargo.push(...allCargoIds.slice(cIdx, cIdx + cargoToTake));
            cIdx += cargoToTake;
        }
        try {
            const priceData = await jita.postMarketPricesBulk({
                itemIds: batchItems.length > 0 ? batchItems : undefined,
                cargoIds: batchCargo.length > 0 ? batchCargo : undefined,
            });
            for (const [id, info] of Object.entries(priceData.data.items)) {
                const p = info;
                const buy = p.highestBuyPrice ?? 0;
                const sell = p.lowestSellPrice ?? 0;
                if (buy > 0 || sell > 0)
                    prices.set(`Item:${id}`, (buy + sell) / 2);
            }
            for (const [id, info] of Object.entries(priceData.data.cargo)) {
                const p = info;
                const buy = p.highestBuyPrice ?? 0;
                const sell = p.lowestSellPrice ?? 0;
                if (buy > 0 || sell > 0)
                    prices.set(`Cargo:${id}`, (buy + sell) / 2);
            }
        }
        catch (e) {
            console.error(`[storage-audit] Price fetch failed (items=${batchItems.length}, cargo=${batchCargo.length}):`, e);
        }
    }
    return prices;
}
// ─── Main Ingestion Logic ───────────────────────────────────────────────────
async function doIngestForClaim(ctx, claimId) {
    // 1. Get storage buildings for this claim
    const buildings = await getStorageBuildings(claimId);
    if (buildings.length === 0)
        return false;
    // 2. Ensure all buildings have fetch state entries
    for (const b of buildings) {
        await ctx.runMutation(internal.storageAudit.upsertFetchState, {
            claimId,
            buildingEntityId: b.entityId,
        });
    }
    // 3. Find stale buildings
    const staleBuildings = await ctx.runQuery(internal.storageAudit.getStaleBuildings, {
        claimId,
        cooldownMs: BUILDING_COOLDOWN_MS,
        limit: MAX_BUILDINGS_PER_REQUEST,
    });
    if (staleBuildings.length === 0)
        return false;
    // 4. Fetch logs for each stale building
    let totalPagesFetched = 0;
    const buildingNameMap = new Map(buildings.map((b) => [b.entityId, b.buildingName ?? "Unknown"]));
    for (const state of staleBuildings) {
        if (totalPagesFetched >= MAX_PAGES_PER_REQUEST)
            break;
        const buildingId = state.buildingEntityId;
        const newestLogId = state.newestLogId;
        const allNewLogs = [];
        const itemMetaMap = new Map();
        let pageAfterId;
        let reachedCursor = false;
        while (!reachedCursor && totalPagesFetched < MAX_PAGES_PER_REQUEST) {
            totalPagesFetched++;
            const params = { buildingEntityId: buildingId, limit: LOG_PAGE_SIZE };
            if (pageAfterId)
                params.afterId = pageAfterId;
            const resp = await jita.getLogsStorage(params);
            const logs = resp.logs;
            for (const item of (resp.items ?? [])) {
                itemMetaMap.set(String(item.id), item);
            }
            for (const cargo of (resp.cargos ?? [])) {
                itemMetaMap.set(String(cargo.id), cargo);
            }
            if (logs.length === 0)
                break;
            for (const log of logs) {
                if (newestLogId && log.id === newestLogId) {
                    reachedCursor = true;
                    break;
                }
                allNewLogs.push(log);
            }
            pageAfterId = logs[logs.length - 1].id;
            if (logs.length < LOG_PAGE_SIZE)
                break;
        }
        // 5. Fetch market prices
        const itemPrices = allNewLogs.length > 0
            ? await fetchItemPrices(allNewLogs)
            : new Map();
        // 6. Insert new logs in batches
        for (let i = 0; i < allNewLogs.length; i += INSERT_BATCH_SIZE) {
            const chunk = allNewLogs.slice(i, i + INSERT_BATCH_SIZE);
            const rows = chunk.map((log) => {
                const itemType = log.data.item_type === "cargo" ? "Cargo" : "Item";
                return {
                    logId: log.id,
                    claimId,
                    playerEntityId: log.subjectEntityId,
                    playerName: log.subjectName,
                    buildingEntityId: buildingId,
                    buildingName: log.building?.buildingName ??
                        buildingNameMap.get(buildingId) ??
                        "Unknown",
                    itemType,
                    itemId: log.data.item_id,
                    itemName: resolveItemName(log.data.item_type, log.data.item_id, itemMetaMap),
                    quantity: log.data.quantity,
                    unitValue: Number(itemPrices.get(`${itemType}:${log.data.item_id}`)) || 0,
                    action: log.data.type.startsWith("deposit")
                        ? "deposit"
                        : "withdraw",
                    timestamp: log.timestamp.replace(/\+\d{2}$/, ""),
                };
            });
            await ctx.runMutation(internal.storageAudit.insertLogBatch, {
                logs: rows,
            });
        }
        // 7. Update fetch state
        const newNewestId = allNewLogs.length > 0 ? allNewLogs[0].id : newestLogId;
        await ctx.runMutation(internal.storageAudit.updateFetchState, {
            claimId,
            buildingEntityId: buildingId,
            newestLogId: newNewestId,
        });
    }
    return true; // may have more stale buildings
}
export const ingestForClaim = internalAction({
    args: { claimId: v.string() },
    handler: async (ctx, args) => doIngestForClaim(ctx, args.claimId),
});
// ─── Ingest All Empire Claims ───────────────────────────────────────────────
export const ingestAll = internalAction({
    args: {},
    handler: async (ctx) => {
        // Discover all claim IDs
        let claimIds = [];
        try {
            const claimsData = await jita.getEmpireClaims(jita.ORDUM_EMPIRE_ID);
            claimIds = claimsData.claims.map((cl) => cl.entityId);
        }
        catch (err) {
            console.error("Failed to discover empire claims:", err);
            return;
        }
        for (const claimId of claimIds) {
            let moreRemaining = true;
            let rounds = 0;
            const MAX_ROUNDS = 10;
            while (moreRemaining && rounds < MAX_ROUNDS) {
                rounds++;
                try {
                    moreRemaining = await doIngestForClaim(ctx, claimId);
                }
                catch (e) {
                    console.error(`Ingestion error (claim=${claimId}, round=${rounds}):`, e);
                    break;
                }
            }
            console.log(`Ingestion: claim=${claimId}, rounds=${rounds}, moreRemaining=${moreRemaining}`);
        }
    },
});
