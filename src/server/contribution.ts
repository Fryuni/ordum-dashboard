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

import { z } from "zod";
import type BitJitaClient from "../common/bitjita-client";

/** Shape of each storage log entry from the BitJita API. */
interface StorageLogEntry {
  id: string;
  objectEntityId: string;
  subjectEntityId: string;
  subjectName: string;
  subjectType: string;
  data: {
    type: string; // "deposit_item" | "withdraw_item" | "deposit_cargo" | "withdraw_cargo"
    item_id: number;
    quantity: number;
    item_type: string; // "item" | "cargo"
  };
  timestamp: string;
  daysSinceEpoch: number;
  regionId: number;
  building: {
    entityId: string;
    buildingDescriptionId: number;
    buildingName: string;
    iconAssetName: string;
  };
}

interface ItemMeta {
  id: number;
  name: string;
  iconAssetName: string;
  tier: number;
  rarityStr: string;
  tag: string;
}

/** Zod schema for the KV cache entry. If the shape changes, old entries
 *  will fail validation and be treated as cache misses. */
const contributionCacheSchema = z.object({
  /** item key ("Item:123" or "Cargo:456") → net quantity */
  aggregate: z.record(z.string(), z.number()),
  /** item key → total deposited (always >= 0) */
  deposited: z.record(z.string(), z.number()),
  /** item key → total withdrawn (always >= 0) */
  withdrawn: z.record(z.string(), z.number()),
  /** ID of the newest log we've processed (logs are newest-first, so highest ID). */
  newestLogId: z.string().nullable(),
  /** ISO timestamp of the last KV write. */
  lastUpdate: z.string(),
});

type ContributionCache = z.infer<typeof contributionCacheSchema>;

export interface ContributionResponse {
  aggregate: Record<string, number>;
  deposited: Record<string, number>;
  withdrawn: Record<string, number>;
  items: Record<string, ItemMeta>;
}

const CACHE_TTL_MS = 20_000;
const LOG_PAGE_SIZE = 1000;

function kvKey(claimId: string, playerEntityId: string): string {
  return `contribution:${claimId}:${playerEntityId}`;
}

function itemKey(itemType: string, itemId: number): string {
  const type = itemType === "cargo" ? "Cargo" : "Item";
  return `${type}:${itemId}`;
}

function signedQuantity(action: string, quantity: number): number {
  return action.startsWith("deposit") ? quantity : -quantity;
}

/**
 * Fetch contribution data for a (claim, player) pair.
 *
 * - If last KV update was < 20 s ago, returns the cached aggregate.
 * - Otherwise, reads new storage logs since the last cursor, updates the
 *   aggregate in KV, and returns the result.
 */
export async function fetchContribution(
  jita: BitJitaClient,
  kv: KVNamespace,
  claimId: string,
  playerEntityId: string,
): Promise<ContributionResponse> {
  // 1. Read cached aggregate from KV (validated — old shapes are treated as misses)
  const cacheKey = kvKey(claimId, playerEntityId);
  const raw = await kv.get(cacheKey, { type: "text" });
  const parsed = raw
    ? contributionCacheSchema.safeParse(JSON.parse(raw))
    : null;
  const cached: ContributionCache | null =
    parsed && parsed.success ? parsed.data : null;

  // 2. If fresh enough, return early
  if (
    cached &&
    Date.now() - new Date(cached.lastUpdate).getTime() < CACHE_TTL_MS
  ) {
    return {
      aggregate: cached.aggregate,
      deposited: cached.deposited,
      withdrawn: cached.withdrawn,
      items: {},
    };
  }

  // 3. Determine which buildings belong to this claim
  const claimInv = await jita.getClaimInventories(claimId);
  const claimBuildingIds = new Set<string>(
    (claimInv.buildings ?? []).map((b) => b.entityId),
  );

  // 4. Fetch new logs for this player, paginating until we reach the cursor
  const allLogs: StorageLogEntry[] = [];
  const allItems: Record<string, ItemMeta> = {};
  let pageAfterId: string | undefined;
  let reachedCursor = false;

  // We paginate newest-to-oldest. Stop when we see the cached newestLogId.
  while (!reachedCursor) {
    const params: {
      playerEntityId: string;
      limit: number;
      afterId?: string;
    } = { playerEntityId, limit: LOG_PAGE_SIZE };
    if (pageAfterId) params.afterId = pageAfterId;

    const resp = await jita.getLogsStorage(params);
    const logs = resp.logs as StorageLogEntry[];
    if (logs.length === 0) break;

    // Collect item/cargo metadata
    for (const item of (resp.items ?? []) as ItemMeta[]) {
      allItems[String(item.id)] = item;
    }
    for (const cargo of (resp.cargos ?? []) as ItemMeta[]) {
      allItems[String(cargo.id)] = cargo;
    }

    for (const log of logs) {
      if (cached?.newestLogId && log.id === cached.newestLogId) {
        reachedCursor = true;
        break;
      }
      allLogs.push(log);
    }

    pageAfterId = logs[logs.length - 1]!.id;

    // If we got fewer results than the page size, we've exhausted the logs.
    if (logs.length < LOG_PAGE_SIZE) break;
  }

  // 5. Filter to claim buildings and build aggregate delta
  const aggregate: Record<string, number> = cached?.aggregate
    ? { ...cached.aggregate }
    : {};
  const deposited: Record<string, number> = cached?.deposited
    ? { ...cached.deposited }
    : {};
  const withdrawn: Record<string, number> = cached?.withdrawn
    ? { ...cached.withdrawn }
    : {};

  // Process in chronological order (oldest first) so the aggregate grows correctly.
  for (let i = allLogs.length - 1; i >= 0; i--) {
    const log = allLogs[i]!;
    if (!claimBuildingIds.has(log.building.entityId)) continue;

    const key = itemKey(log.data.item_type, log.data.item_id);
    const qty = signedQuantity(log.data.type, log.data.quantity);
    aggregate[key] = (aggregate[key] ?? 0) + qty;

    if (log.data.type.startsWith("deposit")) {
      deposited[key] = (deposited[key] ?? 0) + log.data.quantity;
    } else {
      withdrawn[key] = (withdrawn[key] ?? 0) + log.data.quantity;
    }
  }

  // 6. Determine new cursor: the newest log ID we just processed
  const newestLogId =
    allLogs.length > 0 ? allLogs[0]!.id : (cached?.newestLogId ?? null);

  // 7. Persist updated aggregate to KV (no expiration — logs are immutable)
  const updated: ContributionCache = {
    aggregate,
    deposited,
    withdrawn,
    newestLogId,
    lastUpdate: new Date().toISOString(),
  };
  await kv.put(cacheKey, JSON.stringify(updated));

  return { aggregate, deposited, withdrawn, items: allItems };
}
