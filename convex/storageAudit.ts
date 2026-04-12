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
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel";

// ─── Query: Hourly chart data ───────────────────────────────────────────────

function buildChartPoints(
  bucketMap: Map<string, { deposits: number; withdrawals: number }>,
) {
  const sorted = [...bucketMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  let cumulative = 0;
  return sorted.map(([bucket, { deposits, withdrawals }]) => {
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
  });
}

export const auditChart = query({
  args: {
    claimIds: v.array(v.string()),
    playerEntityIds: v.optional(v.array(v.string())),
    itemKeys: v.optional(v.array(v.string())),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { claimIds, playerEntityIds, itemKeys, from, to } = args;

    if (claimIds.length === 0) return [];

    const hasItemFilter = itemKeys != null && itemKeys.length > 0;

    // ── Path B: item filter active — scan raw storageLogs ─────────────
    // The aggregate table has no item dimension, so we compute on-the-fly.
    if (hasItemFilter) {
      const fromTs = from ? from + "T00:00:00" : undefined;
      const toTs = to ? to + "T00:00:00" : undefined;
      const useSinglePlayer =
        playerEntityIds != null && playerEntityIds.length === 1;
      const useSingleItem = itemKeys!.length === 1 && !useSinglePlayer;

      let singleItemType: string | undefined;
      let singleItemId: number | undefined;
      if (useSingleItem) {
        const parts = itemKeys![0]!.split(":");
        singleItemType = parts[0]!;
        singleItemId = Number(parts[1]);
      }

      const allLogs: Doc<"storageLogs">[] = [];
      for (const claimId of claimIds) {
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
        } else if (useSingleItem) {
          q = ctx.db
            .query("storageLogs")
            .withIndex(
              "by_claimId_and_itemType_and_itemId_and_timestamp",
              (idx) => {
                const base = idx
                  .eq("claimId", claimId)
                  .eq("itemType", singleItemType!)
                  .eq("itemId", singleItemId!);
                if (fromTs && toTs)
                  return base.gte("timestamp", fromTs).lt("timestamp", toTs);
                if (fromTs) return base.gte("timestamp", fromTs);
                if (toTs) return base.lt("timestamp", toTs);
                return base;
              },
            );
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

        const logs = await q.order("asc").take(10_000);
        allLogs.push(...logs);
      }

      // In-memory filters
      let filtered: Doc<"storageLogs">[] = allLogs;
      if (playerEntityIds && playerEntityIds.length > 1) {
        const playerSet = new Set(playerEntityIds);
        filtered = filtered.filter((l) => playerSet.has(l.playerEntityId));
      }
      if (!useSingleItem) {
        const parsed = itemKeys!
          .map((k) => k.split(":"))
          .filter((p): p is [string, string] => p.length === 2);
        if (parsed.length > 0) {
          filtered = filtered.filter((l) =>
            parsed.some(
              ([type, id]) => l.itemType === type && l.itemId === Number(id),
            ),
          );
        }
      }

      const bucketMap = new Map<
        string,
        { deposits: number; withdrawals: number }
      >();
      for (const l of filtered) {
        const bucket = l.timestamp.slice(0, 13);
        const entry = bucketMap.get(bucket) ?? { deposits: 0, withdrawals: 0 };
        const value = l.quantity * l.unitValue;
        if (l.action === "deposit") entry.deposits += value;
        else entry.withdrawals += value;
        bucketMap.set(bucket, entry);
      }

      return buildChartPoints(bucketMap);
    }

    // ── Path A: no item filter — read from storageAuditAggregate ──────
    const bucketMap = new Map<
      string,
      { deposits: number; withdrawals: number }
    >();

    for (const claimId of claimIds) {
      if (playerEntityIds && playerEntityIds.length > 0) {
        // Player filter: query per player using the player index
        for (const playerId of playerEntityIds) {
          const rows = await ctx.db
            .query("storageAuditAggregate")
            .withIndex("by_claimId_and_playerEntityId_and_hour", (idx) => {
              const base = idx
                .eq("claimId", claimId)
                .eq("playerEntityId", playerId);
              if (from && to)
                return base.gte("hour", from).lt("hour", to + "U");
              if (from) return base.gte("hour", from);
              if (to) return base.lt("hour", to + "U");
              return base;
            })
            .collect();

          for (const row of rows) {
            const entry = bucketMap.get(row.hour) ?? {
              deposits: 0,
              withdrawals: 0,
            };
            entry.deposits += row.deposits;
            entry.withdrawals += row.withdrawals;
            bucketMap.set(row.hour, entry);
          }
        }
      } else {
        // No player filter: read all players via claim+hour index
        const rows = await ctx.db
          .query("storageAuditAggregate")
          .withIndex("by_claimId_and_hour", (idx) => {
            const base = idx.eq("claimId", claimId);
            if (from && to) return base.gte("hour", from).lt("hour", to + "U");
            if (from) return base.gte("hour", from);
            if (to) return base.lt("hour", to + "U");
            return base;
          })
          .collect();

        for (const row of rows) {
          const entry = bucketMap.get(row.hour) ?? {
            deposits: 0,
            withdrawals: 0,
          };
          entry.deposits += row.deposits;
          entry.withdrawals += row.withdrawals;
          bucketMap.set(row.hour, entry);
        }
      }
    }

    return buildChartPoints(bucketMap);
  },
});

// ─── Internal Mutation: Incremental chart aggregation ───────────────────────

export const aggregateChartData = internalMutation({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    const { claimId } = args;

    // 1. Find the latest existing aggregate bucket for this claim
    const latest = await ctx.db
      .query("storageAuditAggregate")
      .withIndex("by_claimId_and_hour", (idx) => idx.eq("claimId", claimId))
      .order("desc")
      .first();

    const startHour = latest?.hour;
    const startTs = startHour ? startHour + ":00:00" : undefined;

    // 2. Read raw logs from startHour onward (inclusive re-aggregation)
    const q = ctx.db
      .query("storageLogs")
      .withIndex("by_claimId_and_timestamp", (idx) => {
        const base = idx.eq("claimId", claimId);
        if (startTs) return base.gte("timestamp", startTs);
        return base;
      });

    const logs = await q.order("asc").take(10_000);
    if (logs.length === 0) return;

    // 3. Group by (hour, playerEntityId)
    const buckets = new Map<
      string, // key: "hour\0playerEntityId"
      {
        hour: string;
        playerEntityId: string;
        deposits: number;
        withdrawals: number;
      }
    >();

    for (const log of logs) {
      const hour = log.timestamp.slice(0, 13);
      const key = `${hour}\0${log.playerEntityId}`;
      const entry = buckets.get(key) ?? {
        hour,
        playerEntityId: log.playerEntityId,
        deposits: 0,
        withdrawals: 0,
      };
      const value = log.quantity * log.unitValue;
      if (log.action === "deposit") entry.deposits += value;
      else entry.withdrawals += value;
      buckets.set(key, entry);
    }

    // 4. Upsert each bucket
    for (const data of buckets.values()) {
      const existing = await ctx.db
        .query("storageAuditAggregate")
        .withIndex("by_claimId_and_playerEntityId_and_hour", (idx) =>
          idx
            .eq("claimId", claimId)
            .eq("playerEntityId", data.playerEntityId)
            .eq("hour", data.hour),
        )
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, {
          claimId,
          hour: data.hour,
          playerEntityId: data.playerEntityId,
          deposits: data.deposits,
          withdrawals: data.withdrawals,
        });
      } else {
        await ctx.db.insert("storageAuditAggregate", {
          claimId,
          hour: data.hour,
          playerEntityId: data.playerEntityId,
          deposits: data.deposits,
          withdrawals: data.withdrawals,
        });
      }
    }
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function transformLog(l: Doc<"storageLogs">) {
  return {
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
  };
}

// ─── Query: Cursor-paginated storage audit logs ─────────────────────────────

export const queryAuditPage = query({
  args: {
    claimIds: v.array(v.string()),
    playerEntityIds: v.optional(v.array(v.string())),
    itemKeys: v.optional(v.array(v.string())),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { claimIds, playerEntityIds, itemKeys, from, to, paginationOpts } =
      args;

    if (claimIds.length === 0) {
      return {
        page: [] as ReturnType<typeof transformLog>[],
        isDone: true,
        continueCursor: "",
      };
    }

    const fromTs = from ? from + "T00:00:00" : undefined;
    const toTs = to ? to + "T00:00:00" : undefined;
    const numItems = paginationOpts.numItems;

    // Pick the most specific index for the active filters.
    const useSinglePlayer =
      playerEntityIds != null && playerEntityIds.length === 1;
    const useSingleItem =
      itemKeys != null && itemKeys.length === 1 && !useSinglePlayer;

    let singleItemType: string | undefined;
    let singleItemId: number | undefined;
    if (useSingleItem) {
      const parts = itemKeys![0]!.split(":");
      singleItemType = parts[0]!;
      singleItemId = Number(parts[1]);
    }

    // Apply filters that the chosen index doesn't cover.
    function applyInMemoryFilters(logs: Doc<"storageLogs">[]) {
      let filtered = logs;
      if (playerEntityIds && playerEntityIds.length > 0 && !useSinglePlayer) {
        const playerSet = new Set(playerEntityIds);
        filtered = filtered.filter((l) => playerSet.has(l.playerEntityId));
      }
      if (itemKeys && itemKeys.length > 0 && !useSingleItem) {
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
      return filtered;
    }

    // Build an indexed query for one claim, optionally capping the upper
    // timestamp bound (used for multi-claim timestamp-based cursors).
    function queryForClaim(claimId: string, upperTs?: string) {
      const effectiveUpper =
        upperTs && (!toTs || upperTs < toTs) ? upperTs : toTs;

      if (useSinglePlayer) {
        return ctx.db
          .query("storageLogs")
          .withIndex("by_claimId_and_playerEntityId_and_timestamp", (idx) => {
            const base = idx
              .eq("claimId", claimId)
              .eq("playerEntityId", playerEntityIds![0]!);
            if (fromTs && effectiveUpper)
              return base
                .gte("timestamp", fromTs)
                .lt("timestamp", effectiveUpper);
            if (fromTs) return base.gte("timestamp", fromTs);
            if (effectiveUpper) return base.lt("timestamp", effectiveUpper);
            return base;
          });
      }

      if (useSingleItem) {
        return ctx.db
          .query("storageLogs")
          .withIndex(
            "by_claimId_and_itemType_and_itemId_and_timestamp",
            (idx) => {
              const base = idx
                .eq("claimId", claimId)
                .eq("itemType", singleItemType!)
                .eq("itemId", singleItemId!);
              if (fromTs && effectiveUpper)
                return base
                  .gte("timestamp", fromTs)
                  .lt("timestamp", effectiveUpper);
              if (fromTs) return base.gte("timestamp", fromTs);
              if (effectiveUpper) return base.lt("timestamp", effectiveUpper);
              return base;
            },
          );
      }

      return ctx.db
        .query("storageLogs")
        .withIndex("by_claimId_and_timestamp", (idx) => {
          const base = idx.eq("claimId", claimId);
          if (fromTs && effectiveUpper)
            return base
              .gte("timestamp", fromTs)
              .lt("timestamp", effectiveUpper);
          if (fromTs) return base.gte("timestamp", fromTs);
          if (effectiveUpper) return base.lt("timestamp", effectiveUpper);
          return base;
        });
    }

    // ── Single claim — use Convex .paginate() for precise cursors ──────
    if (claimIds.length === 1) {
      const claimId = claimIds[0]!;

      // Unwrap cursor: we wrap the Convex opaque cursor in a JSON envelope
      // so both single-claim and multi-claim cursors share the same string
      // type at the API boundary.
      let innerCursor: string | null = null;
      if (paginationOpts.cursor !== null) {
        innerCursor = JSON.parse(paginationOpts.cursor).c;
      }

      const result = await queryForClaim(claimId)
        .order("desc")
        .paginate({ numItems, cursor: innerCursor });

      const filtered = applyInMemoryFilters(result.page);

      return {
        page: filtered.map(transformLog),
        isDone: result.isDone,
        continueCursor: JSON.stringify({ c: result.continueCursor }),
      };
    }

    // ── Multi claim — timestamp-based cursor with .take() ─────────────
    // For multiple claims we use the timestamp of the last displayed item
    // as a sliding upper bound. This avoids the data-loss problem that
    // would occur with opaque per-claim cursors (items from less-active
    // claims would be permanently skipped when their cursor advances past
    // items that weren't included in the merged page).
    let lastTs: string | undefined;
    if (paginationOpts.cursor !== null) {
      lastTs = JSON.parse(paginationOpts.cursor).ts;
    }

    const allLogs: Doc<"storageLogs">[] = [];
    let allExhausted = true;

    for (const claimId of claimIds) {
      const logs = await queryForClaim(claimId, lastTs)
        .order("desc")
        .take(numItems);
      if (logs.length >= numItems) allExhausted = false;
      allLogs.push(...logs);
    }

    let filtered = applyInMemoryFilters(allLogs);
    filtered.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    const pageItems = filtered.slice(0, numItems);

    const isDone = allExhausted && filtered.length <= numItems;
    const lastItem = pageItems[pageItems.length - 1];

    return {
      page: pageItems.map(transformLog),
      isDone,
      continueCursor: lastItem
        ? JSON.stringify({ ts: lastItem.timestamp })
        : "",
    };
  },
});

// ─── Query: Filter-option data for dropdowns (decoupled from pagination) ──

export const queryAuditFilterOptions = query({
  args: {
    claimIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { claimIds } = args;

    if (claimIds.length === 0) {
      return { players: [] };
    }

    // Players: read from claimMembers (only those with inventory permission)
    const playerMap = new Map<string, string>();
    for (const claimId of claimIds) {
      const members = await ctx.db
        .query("claimMembers")
        .withIndex("by_claimId", (idx) => idx.eq("claimId", claimId))
        .collect();
      for (const m of members) {
        if (m.inventoryPermission && !playerMap.has(m.playerEntityId)) {
          playerMap.set(m.playerEntityId, m.userName);
        }
      }
    }

    return {
      players: [...playerMap.entries()]
        .map(([entityId, name]) => ({ entityId, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
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
