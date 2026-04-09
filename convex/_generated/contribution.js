/**
 * Contribution tracker — Convex action that calls BitJita API.
 * Migrated from src/server/contribution.ts.
 *
 * This was previously KV-cached. Now it's a pure action that fetches
 * all logs from BitJita on demand. The client can cache results locally.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import * as jita from "./lib/bitjita";
const EXCLUDED_ITEMS = new Set(["Cargo:2000000"]);
const FIXED_VALUE = new Map([["Item:1", 1]]); // Hex Coin
const LOG_PAGE_SIZE = 1000;
const PRICE_BATCH_SIZE = 100;
function itemKey(itemType, itemId) {
    const type = itemType === "cargo" ? "Cargo" : "Item";
    return `${type}:${itemId}`;
}
function parseItemKey(key) {
    const parts = key.split(":");
    return { type: parts[0] ?? "", id: Number(parts[1]) };
}
export const getContribution = action({
    args: {
        claimId: v.string(),
        playerEntityId: v.string(),
    },
    handler: async (_ctx, args) => {
        const { claimId, playerEntityId } = args;
        // 1. Get claim buildings
        const claimInv = await jita.getClaimInventories(claimId);
        const claimBuildingIds = new Set((claimInv.buildings ?? []).map((b) => b.entityId));
        // 2. Fetch all storage logs for this player
        const allLogs = [];
        const allItems = {};
        let pageAfterId;
        while (true) {
            const params = { playerEntityId, limit: LOG_PAGE_SIZE };
            if (pageAfterId)
                params.afterId = pageAfterId;
            const resp = await jita.getLogsStorage(params);
            const logs = resp.logs;
            if (logs.length === 0)
                break;
            for (const item of (resp.items ?? [])) {
                allItems[String(item.id)] = item;
            }
            for (const cargo of (resp.cargos ?? [])) {
                allItems[String(cargo.id)] = cargo;
            }
            allLogs.push(...logs);
            pageAfterId = logs[logs.length - 1].id;
            if (logs.length < LOG_PAGE_SIZE)
                break;
        }
        // 3. Filter to claim buildings and accumulate
        const deposited = {};
        const withdrawn = {};
        for (let i = allLogs.length - 1; i >= 0; i--) {
            const log = allLogs[i];
            if (!claimBuildingIds.has(log.building.entityId))
                continue;
            const key = itemKey(log.data.item_type, log.data.item_id);
            if (EXCLUDED_ITEMS.has(key))
                continue;
            if (log.data.type.startsWith("deposit")) {
                deposited[key] = (deposited[key] ?? 0) + log.data.quantity;
            }
            else {
                withdrawn[key] = (withdrawn[key] ?? 0) + log.data.quantity;
            }
        }
        // 4. Fetch market prices
        const allItemKeys = new Set([
            ...Object.keys(deposited),
            ...Object.keys(withdrawn),
        ]);
        const itemIds = [];
        const cargoIds = [];
        for (const key of allItemKeys) {
            if (FIXED_VALUE.has(key))
                continue;
            const { type, id } = parseItemKey(key);
            if (type === "Cargo")
                cargoIds.push(id);
            else
                itemIds.push(id);
        }
        const prices = {};
        for (const [key, value] of FIXED_VALUE.entries()) {
            prices[key] = value;
        }
        try {
            let iIdx = 0;
            let cIdx = 0;
            while (iIdx < itemIds.length || cIdx < cargoIds.length) {
                const batchItems = [];
                const batchCargo = [];
                let remaining = PRICE_BATCH_SIZE;
                const itemsToTake = Math.min(itemIds.length - iIdx, remaining);
                batchItems.push(...itemIds.slice(iIdx, iIdx + itemsToTake));
                iIdx += itemsToTake;
                remaining -= itemsToTake;
                if (remaining > 0) {
                    const cargoToTake = Math.min(cargoIds.length - cIdx, remaining);
                    batchCargo.push(...cargoIds.slice(cIdx, cIdx + cargoToTake));
                    cIdx += cargoToTake;
                }
                const priceData = await jita.postMarketPricesBulk({
                    itemIds: batchItems.length > 0 ? batchItems : undefined,
                    cargoIds: batchCargo.length > 0 ? batchCargo : undefined,
                });
                for (const [id, info] of Object.entries(priceData.data.items)) {
                    const p = info;
                    const buy = p.highestBuyPrice ?? 0;
                    const sell = p.lowestSellPrice ?? 0;
                    if (buy > 0 || sell > 0)
                        prices[`Item:${id}`] = (buy + sell) / 2;
                }
                for (const [id, info] of Object.entries(priceData.data.cargo)) {
                    const p = info;
                    const buy = p.highestBuyPrice ?? 0;
                    const sell = p.lowestSellPrice ?? 0;
                    if (buy > 0 || sell > 0)
                        prices[`Cargo:${id}`] = (buy + sell) / 2;
                }
            }
        }
        catch (e) {
            console.error("Failed to fetch market prices:", e);
        }
        return { deposited, withdrawn, prices, items: allItems };
    },
});
