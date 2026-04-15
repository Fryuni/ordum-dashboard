/**
 * Empire Data — internal mutations (called by sync) and public queries
 * (consumed by client subscriptions).
 *
 * All empire/claim data is synced from BitJita into Convex tables by
 * empireSync.ts. This file provides the read and write interfaces.
 */
import { v } from "convex/values";
import {
  query,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { ORDUM_EMPIRE_ID } from "./lib/bitjita";
import { somethingChanged } from "./lib/compare";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Building description IDs for bank buildings (personal storage) */
const BANK_BUILDING_IDS = new Set([
  985246037, // Town Bank
  1615467546, // Ancient Bank
  969744821, // Lost Items Chest
]);

// ─── Internal Mutations (called by empireSync) ─────────────────────────────

export const upsertEmpireInfo = internalMutation({
  args: {
    empireId: v.string(),
    name: v.string(),
    hexiteReserve: v.number(),
    capitalClaimId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("empireInfo")
      .withIndex("by_empireId", (q) => q.eq("empireId", args.empireId))
      .unique();
    if (existing) {
      if (somethingChanged(existing, args)) {
        await ctx.db.patch(existing._id, {
          name: args.name,
          hexiteReserve: args.hexiteReserve,
          capitalClaimId: args.capitalClaimId,
          syncedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("empireInfo", {
        empireId: args.empireId,
        name: args.name,
        hexiteReserve: args.hexiteReserve,
        capitalClaimId: args.capitalClaimId,
        syncedAt: Date.now(),
      });
    }
  },
});

export const syncClaim = internalMutation({
  args: {
    empireId: v.string(),
    claimId: v.string(),
    name: v.string(),
    region: v.string(),
    tier: v.optional(v.number()),
    supplies: v.number(),
    treasury: v.number(),
    numTiles: v.number(),
    buildingCount: v.number(),
    ownerBuildingEntityId: v.string(),
    learnedTechIds: v.array(v.number()),
    locationX: v.optional(v.number()),
    locationZ: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("empireClaims")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .unique();
    const data = { ...args, syncedAt: Date.now() };
    if (existing) {
      if (somethingChanged(existing, args)) {
        await ctx.db.patch(existing._id, data);
      }
    } else {
      await ctx.db.insert("empireClaims", data);
    }
  },
});

export const syncClaimMembers = internalMutation({
  args: {
    claimId: v.string(),
    members: v.array(
      v.object({
        playerEntityId: v.string(),
        userName: v.string(),
        inventoryPermission: v.boolean(),
        buildPermission: v.boolean(),
        officerPermission: v.boolean(),
        coOwnerPermission: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing members for this claim
    await deleteByClaimId(ctx, "claimMembers", args.claimId);
    // Insert fresh
    const now = Date.now();
    for (const m of args.members) {
      await ctx.db.insert("claimMembers", {
        claimId: args.claimId,
        ...m,
        syncedAt: now,
      });
    }
  },
});

export const syncBuildingInventories = internalMutation({
  args: {
    claimId: v.string(),
    buildings: v.array(
      v.object({
        buildingEntityId: v.string(),
        buildingDescriptionId: v.number(),
        buildingName: v.string(),
        buildingNickname: v.optional(v.string()),
        items: v.array(
          v.object({
            itemType: v.string(),
            itemId: v.number(),
            quantity: v.number(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await deleteByClaimId(ctx, "buildingInventories", args.claimId);
    const now = Date.now();
    for (const b of args.buildings) {
      await ctx.db.insert("buildingInventories", {
        claimId: args.claimId,
        ...b,
        syncedAt: now,
      });
    }
  },
});

export const syncClaimCrafts = internalMutation({
  args: {
    claimId: v.string(),
    crafts: v.array(
      v.object({
        recipeId: v.number(),
        buildingName: v.string(),
        craftCount: v.number(),
        progress: v.number(),
        totalActionsRequired: v.number(),
        ownerEntityId: v.string(),
        ownerUsername: v.string(),
        isPassive: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await deleteByClaimId(ctx, "claimCrafts", args.claimId);
    const now = Date.now();
    for (const c of args.crafts) {
      await ctx.db.insert("claimCrafts", {
        claimId: args.claimId,
        ...c,
        syncedAt: now,
      });
    }
  },
});

export const syncConstructionProjects = internalMutation({
  args: {
    claimId: v.string(),
    projects: v.array(
      v.object({
        projectEntityId: v.string(),
        buildingName: v.string(),
        buildingNickname: v.optional(v.string()),
        constructionRecipeId: v.number(),
        depositedItems: v.array(
          v.object({
            itemType: v.string(),
            itemId: v.number(),
            quantity: v.number(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await deleteByClaimId(ctx, "constructionProjects", args.claimId);
    const now = Date.now();
    for (const p of args.projects) {
      await ctx.db.insert("constructionProjects", {
        claimId: args.claimId,
        ...p,
        syncedAt: now,
      });
    }
  },
});

export const removeStaleClaimData = internalMutation({
  args: {
    empireId: v.string(),
    activeClaimIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const active = new Set(args.activeClaimIds);
    const allClaims = await ctx.db
      .query("empireClaims")
      .withIndex("by_empireId", (q) => q.eq("empireId", args.empireId))
      .collect();
    for (const claim of allClaims) {
      if (!active.has(claim.claimId)) {
        await deleteByClaimId(ctx, "claimMembers", claim.claimId);
        await deleteByClaimId(ctx, "buildingInventories", claim.claimId);
        await deleteByClaimId(ctx, "claimCrafts", claim.claimId);
        await deleteByClaimId(ctx, "constructionProjects", claim.claimId);
        await ctx.db.delete(claim._id);
      }
    }
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function deleteByClaimId(
  ctx: MutationCtx,
  table:
    | "claimMembers"
    | "buildingInventories"
    | "claimCrafts"
    | "constructionProjects",
  claimId: string,
) {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_claimId", (q) => q.eq("claimId", claimId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

// ─── Public Queries ─────────────────────────────────────────────────────────

export const getEmpires = query(async (ctx) => {
  const empires: Array<{ id: string; name: string }> = [];
  for await (const empire of ctx.db.query("empireInfo").fullTableScan()) {
    empires.push({
      id: empire.empireId,
      name: empire.name ?? "Unknown empire",
    });
  }
  if (empires.length === 0) {
    empires.push({
      id: ORDUM_EMPIRE_ID,
      name: "Ordum",
    });
  }
  return empires;
});

export const getEmpireClaims = query({
  args: { empireId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const empireId = args.empireId ?? ORDUM_EMPIRE_ID;
    const claims = await ctx.db
      .query("empireClaims")
      .withIndex("by_empireId", (q) => q.eq("empireId", empireId))
      .collect();

    const info = await ctx.db
      .query("empireInfo")
      .withIndex("by_empireId", (q) => q.eq("empireId", empireId))
      .unique();

    return {
      claims: claims.map((c) => ({ id: c.claimId, name: c.name })),
      capitalClaimId: info?.capitalClaimId ?? claims[0]?.claimId ?? null,
    };
  },
});

export const getDashboardData = query({
  args: { empireId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const empireId = args.empireId ?? ORDUM_EMPIRE_ID;
    const info = await ctx.db
      .query("empireInfo")
      .withIndex("by_empireId", (q) => q.eq("empireId", empireId))
      .unique();

    if (!info) throw new Error("Unknown empire ID");

    const claims = await ctx.db
      .query("empireClaims")
      .withIndex("by_empireId", (q) => q.eq("empireId", empireId))
      .collect();

    // Fetch members per claim for member counts
    const claimsWithMembers = await Promise.all(
      claims.map(async (claim) => {
        const members = await ctx.db
          .query("claimMembers")
          .withIndex("by_claimId", (q) => q.eq("claimId", claim.claimId))
          .collect();
        return {
          entity_id: claim.claimId,
          owner_building_entity_id: claim.ownerBuildingEntityId,
          name: claim.name,
          region: claim.region,
          tier: claim.tier ?? null,
          supplies: claim.supplies,
          treasury: claim.treasury,
          num_tiles: claim.numTiles,
          member_count: members.length,
          building_count: claim.buildingCount,
          members: members.map((m) => ({
            entity_id: m.playerEntityId,
            user_name: m.userName,
            inventory_permission: m.inventoryPermission,
            build_permission: m.buildPermission,
            officer_permission: m.officerPermission,
            co_owner_permission: m.coOwnerPermission,
          })),
        };
      }),
    );

    let totalMembers = 0;
    let totalBuildings = 0;
    let totalTiles = 0;
    for (const c of claimsWithMembers) {
      totalMembers += c.member_count;
      totalBuildings += c.building_count;
      totalTiles += c.num_tiles;
    }

    return {
      claims: claimsWithMembers,
      totals: {
        total_members: totalMembers,
        total_buildings: totalBuildings,
        total_tiles: totalTiles,
      },
      empireId: info?.empireId ?? empireId,
      empireName: info?.name ?? "Unknown empire",
      hexite_reserve: info?.hexiteReserve ?? 0,
      capital_claim_entity_id: info?.capitalClaimId ?? null,
      synced_at: info?.syncedAt ?? null,
    };
  },
});

export const getClaimInventory = query({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("empireClaims")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .unique();

    const buildings = await ctx.db
      .query("buildingInventories")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .collect();

    // Aggregate items across buildings
    const itemMap = new Map<
      string,
      {
        itemType: string;
        itemId: number;
        totalQuantity: number;
        locations: Array<{ name: string; quantity: number }>;
      }
    >();

    for (const building of buildings) {
      // Bank buildings should already be filtered during sync, but double-check
      if (BANK_BUILDING_IDS.has(building.buildingDescriptionId)) continue;

      const label = building.buildingNickname ?? building.buildingName;
      for (const item of building.items) {
        if (item.quantity <= 0) continue;
        const key = `${item.itemType}:${item.itemId}`;
        let entry = itemMap.get(key);
        if (!entry) {
          entry = {
            itemType: item.itemType,
            itemId: item.itemId,
            totalQuantity: 0,
            locations: [],
          };
          itemMap.set(key, entry);
        }
        entry.totalQuantity += item.quantity;
        const existingLoc = entry.locations.find((l) => l.name === label);
        if (existingLoc) {
          existingLoc.quantity += item.quantity;
        } else {
          entry.locations.push({ name: label, quantity: item.quantity });
        }
      }
    }

    return {
      items: [...itemMap.entries()].map(([key, val]) => ({
        key,
        ...val,
      })),
      claimName: claim?.name ?? "Unknown Claim",
      regionName: claim?.region ?? "Unknown Region",
      claimLocationX: claim?.locationX ?? 0,
      claimLocationZ: claim?.locationZ ?? 0,
    };
  },
});

export const getSettlementData = query({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("empireClaims")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .unique();

    if (!claim) {
      return null;
    }

    // Build inventory map from building inventories
    const buildings = await ctx.db
      .query("buildingInventories")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .collect();

    const inventory: Record<string, number> = {};
    for (const building of buildings) {
      for (const item of building.items) {
        const key = `${item.itemType}:${item.itemId}`;
        inventory[key] = (inventory[key] ?? 0) + item.quantity;
      }
    }

    return {
      currentTier: claim.tier ?? 1,
      supplies: claim.supplies,
      learnedCount: claim.learnedTechIds.length,
      claimName: claim.name,
      learnedIds: claim.learnedTechIds,
      inventory,
    };
  },
});

export const getConstructionData = query({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("constructionProjects")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .collect();

    return {
      projects: projects.map((p) => ({
        entityId: p.projectEntityId,
        buildingName: p.buildingName,
        buildingNickname: p.buildingNickname,
        constructionRecipeId: p.constructionRecipeId,
        depositedItems: p.depositedItems,
      })),
    };
  },
});

export const getClaimCrafts = query({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    const crafts = await ctx.db
      .query("claimCrafts")
      .withIndex("by_claimId", (q) => q.eq("claimId", args.claimId))
      .collect();

    return crafts.map((c) => ({
      recipeId: c.recipeId,
      buildingName: c.buildingName,
      craftCount: c.craftCount,
      progress: c.progress,
      totalActionsRequired: c.totalActionsRequired,
      ownerEntityId: c.ownerEntityId,
      ownerUsername: c.ownerUsername,
      isPassive: c.isPassive,
    }));
  },
});

export const getAllClaimInventories = query({
  args: { empireId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const empireId = args.empireId ?? ORDUM_EMPIRE_ID;
    const claims = await ctx.db
      .query("empireClaims")
      .withIndex("by_empireId", (q) => q.eq("empireId", empireId))
      .collect();

    const result = [];
    for (const claim of claims) {
      const buildings = await ctx.db
        .query("buildingInventories")
        .withIndex("by_claimId", (q) => q.eq("claimId", claim.claimId))
        .collect();

      const crafts = await ctx.db
        .query("claimCrafts")
        .withIndex("by_claimId", (q) => q.eq("claimId", claim.claimId))
        .collect();

      // Aggregate items across buildings (excluding personal storage)
      const itemMap = new Map<
        string,
        { locations: Array<{ name: string; quantity: number }> }
      >();

      for (const building of buildings) {
        if (BANK_BUILDING_IDS.has(building.buildingDescriptionId)) continue;
        const label = building.buildingNickname ?? building.buildingName;
        for (const item of building.items) {
          if (item.quantity <= 0) continue;
          const key = `${item.itemType}:${item.itemId}`;
          let entry = itemMap.get(key);
          if (!entry) {
            entry = { locations: [] };
            itemMap.set(key, entry);
          }
          const existingLoc = entry.locations.find((l) => l.name === label);
          if (existingLoc) {
            existingLoc.quantity += item.quantity;
          } else {
            entry.locations.push({ name: label, quantity: item.quantity });
          }
        }
      }

      result.push({
        claimId: claim.claimId,
        claimName: claim.name,
        items: [...itemMap.entries()].map(([key, val]) => ({
          key,
          locations: val.locations,
        })),
        crafts: crafts.map((c) => ({
          recipeId: c.recipeId,
          craftCount: c.craftCount,
          progress: c.progress,
          totalActionsRequired: c.totalActionsRequired,
          isPassive: c.isPassive,
        })),
      });
    }

    return result;
  },
});

// ─── Internal Queries (for actions that need DB reads) ──────────────────────

export const getAllMemberEntityIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("claimMembers").collect();
    return members.map((m) => m.playerEntityId);
  },
});
