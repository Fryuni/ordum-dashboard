/**
 * Storage Audit — Convex queries for reading audit log data.
 * Migrated from D1 queryStorageAudit.
 */
import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Query: Paginated storage audit logs with chart data ────────────────────

export const queryAudit = query({
  args: {
    claimIds: v.array(v.string()),
    playerEntityIds: v.optional(v.array(v.string())),
    itemKeys: v.optional(v.array(v.string())),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { claimIds, playerEntityIds, itemKeys, from, to, page, pageSize } =
      args;
    if (claimIds.length === 0) {
      return {
        logs: [],
        totalCount: 0,
        page,
        pageSize,
        chartData: [],
        players: [],
        items: [],
      };
    }

    // Query per-claim using index range bounds on timestamp to avoid
    // unbounded table scans, then merge results across claims.
    const MAX_LOGS_PER_CLAIM = 10_000;
    const fromTs = from ? from + "T00:00:00" : undefined;
    const toTs = to ? to + "T00:00:00" : undefined;
    const allLogs: any[] = [];

    for (const claimId of claimIds) {
      // Use the most specific index available, with timestamp bounds.
      // Enumerate range combos explicitly for Convex's progressive type narrowing.
      const useSinglePlayer =
        playerEntityIds &&
        playerEntityIds.length === 1 &&
        (!itemKeys || itemKeys.length === 0);

      let q;
      if (useSinglePlayer) {
        q = ctx.db
          .query("storageLogs")
          .withIndex("by_claimId_and_playerEntityId_and_timestamp", (idx) => {
            const base = idx
              .eq("claimId", claimId)
              .eq("playerEntityId", playerEntityIds![0]!);
            if (fromTs && toTs)
              return base.gte("timestamp", fromTs).lt("timestamp", toTs);
            if (fromTs) return base.gte("timestamp", fromTs);
            if (toTs) return base.lt("timestamp", toTs);
            return base;
          });
      } else {
        q = ctx.db
          .query("storageLogs")
          .withIndex("by_claimId_and_timestamp", (idx) => {
            const base = idx.eq("claimId", claimId);
            if (fromTs && toTs)
              return base.gte("timestamp", fromTs).lt("timestamp", toTs);
            if (fromTs) return base.gte("timestamp", fromTs);
            if (toTs) return base.lt("timestamp", toTs);
            return base;
          });
      }

      const logs = await q.order("desc").take(MAX_LOGS_PER_CLAIM);
      allLogs.push(...logs);
    }

    // Apply in-memory filters for dimensions not covered by the index
    let filtered = allLogs;

    if (playerEntityIds && playerEntityIds.length > 0) {
      const playerSet = new Set(playerEntityIds);
      filtered = filtered.filter((l) => playerSet.has(l.playerEntityId));
    }
    if (itemKeys && itemKeys.length > 0) {
      const parsed = itemKeys
        .map((k) => k.split(":"))
        .filter((parts): parts is [string, string] => parts.length === 2);
      if (parsed.length > 0) {
        filtered = filtered.filter((l) =>
          parsed.some(
            ([type, id]) => l.itemType === type && l.itemId === Number(id),
          ),
        );
      }
    }

    // Sort by timestamp desc (may already be sorted per-claim, but not across claims)
    filtered.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

    const totalCount = filtered.length;

    // Paginate
    const offset = (page - 1) * pageSize;
    const pagedLogs = filtered.slice(offset, offset + pageSize).map((l) => ({
      id: l.logId,
      claim_id: l.claimId,
      player_entity_id: l.playerEntityId,
      player_name: l.playerName,
      building_name: l.buildingName,
      item_type: l.itemType,
      item_id: l.itemId,
      item_name: l.itemName,
      quantity: l.quantity,
      unit_value: l.unitValue,
      action: l.action,
      timestamp: l.timestamp,
    }));

    // Chart data: hourly aggregates (value = quantity × unit_value)
    const bucketMap = new Map<
      string,
      { deposits: number; withdrawals: number }
    >();
    for (const l of filtered) {
      const bucket = l.timestamp.slice(0, 13); // "YYYY-MM-DDTHH"
      const entry = bucketMap.get(bucket) ?? { deposits: 0, withdrawals: 0 };
      const value = l.quantity * l.unitValue;
      if (l.action === "deposit") entry.deposits += value;
      else entry.withdrawals += value;
      bucketMap.set(bucket, entry);
    }

    const sortedBuckets = [...bucketMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    let cumulative = 0;
    const chartData = sortedBuckets.map(
      ([bucket, { deposits, withdrawals }]) => {
        const net = deposits - withdrawals;
        const cumOpen = cumulative;
        cumulative += net;
        return {
          bucket,
          deposits,
          withdrawals,
          net,
          cumOpen,
          cumClose: cumulative,
        };
      },
    );

    // Distinct players for filter dropdown
    const playerMap = new Map<string, string>();
    for (const l of allLogs) {
      if (!playerMap.has(l.playerEntityId)) {
        playerMap.set(l.playerEntityId, l.playerName);
      }
    }
    const players = [...playerMap.entries()]
      .map(([entityId, name]) => ({ entityId, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Distinct items for filter dropdown
    const itemMap = new Map<
      string,
      { id: number; type: string; name: string }
    >();
    for (const l of allLogs) {
      const key = `${l.itemType}:${l.itemId}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          id: l.itemId,
          type: l.itemType,
          name: l.itemName,
        });
      }
    }
    const items = [...itemMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      logs: pagedLogs,
      totalCount,
      page,
      pageSize,
      chartData,
      players,
      items,
    };
  },
});

// ─── Internal Mutations: Used by ingestion action ───────────────────────────

export const upsertFetchState = internalMutation({
  args: {
    claimId: v.string(),
    buildingEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("storageFetchState")
      .withIndex("by_claimId_and_buildingEntityId", (idx) =>
        idx
          .eq("claimId", args.claimId)
          .eq("buildingEntityId", args.buildingEntityId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("storageFetchState", {
        claimId: args.claimId,
        buildingEntityId: args.buildingEntityId,
      });
    }
  },
});

export const getStaleBuildings = internalQuery({
  args: {
    claimId: v.string(),
    cooldownMs: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.cooldownMs;
    const all = await ctx.db
      .query("storageFetchState")
      .withIndex("by_claimId_and_buildingEntityId", (idx) =>
        idx.eq("claimId", args.claimId),
      )
      .collect();

    // Filter stale buildings and sort by updatedAt ascending (nulls first)
    return all
      .filter((s) => !s.updatedAt || s.updatedAt < cutoff)
      .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
      .slice(0, args.limit)
      .map((s) => ({
        buildingEntityId: s.buildingEntityId,
        newestLogId: s.newestLogId,
      }));
  },
});

export const insertLogBatch = internalMutation({
  args: {
    logs: v.array(
      v.object({
        logId: v.string(),
        claimId: v.string(),
        playerEntityId: v.string(),
        playerName: v.string(),
        buildingEntityId: v.string(),
        buildingName: v.string(),
        itemType: v.string(),
        itemId: v.number(),
        itemName: v.string(),
        quantity: v.number(),
        unitValue: v.number(),
        action: v.string(),
        timestamp: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const log of args.logs) {
      // Deduplicate by logId
      const existing = await ctx.db
        .query("storageLogs")
        .withIndex("by_logId", (idx) => idx.eq("logId", log.logId))
        .unique();
      if (!existing) {
        await ctx.db.insert("storageLogs", log);
      }
    }
  },
});

// Used by the D1 → Convex migration script. Takes a big page of logs and
// fans out to `insertLogBatch` in smaller chunks that fit under the mutation
// runtime limit. Lets the script pay the `convex run` subprocess overhead
// once per ~2000 logs instead of once per ~250.
export const importLogsAction = internalAction({
  args: {
    logs: v.array(
      v.object({
        logId: v.string(),
        claimId: v.string(),
        playerEntityId: v.string(),
        playerName: v.string(),
        buildingEntityId: v.string(),
        buildingName: v.string(),
        itemType: v.string(),
        itemId: v.number(),
        itemName: v.string(),
        quantity: v.number(),
        unitValue: v.number(),
        action: v.string(),
        timestamp: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const CHUNK = 250;
    for (let i = 0; i < args.logs.length; i += CHUNK) {
      await ctx.runMutation(internal.storageAudit.insertLogBatch, {
        logs: args.logs.slice(i, i + CHUNK),
      });
    }
    return { processed: args.logs.length };
  },
});

// Used by the D1 → Convex migration script to seed fetch state without
// overwriting any rows already written by the production ingestion cron.
export const importFetchStateBatch = internalMutation({
  args: {
    states: v.array(
      v.object({
        claimId: v.string(),
        buildingEntityId: v.string(),
        newestLogId: v.optional(v.string()),
        updatedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skipped = 0;
    for (const s of args.states) {
      const existing = await ctx.db
        .query("storageFetchState")
        .withIndex("by_claimId_and_buildingEntityId", (idx) =>
          idx
            .eq("claimId", s.claimId)
            .eq("buildingEntityId", s.buildingEntityId),
        )
        .unique();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("storageFetchState", s);
      inserted++;
    }
    return { inserted, skipped };
  },
});

export const updateFetchState = internalMutation({
  args: {
    claimId: v.string(),
    buildingEntityId: v.string(),
    newestLogId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("storageFetchState")
      .withIndex("by_claimId_and_buildingEntityId", (idx) =>
        idx
          .eq("claimId", args.claimId)
          .eq("buildingEntityId", args.buildingEntityId),
      )
      .unique();
    if (state) {
      await ctx.db.patch(state._id, {
        newestLogId: args.newestLogId ?? state.newestLogId,
        updatedAt: Date.now(),
      });
    }
  },
});
