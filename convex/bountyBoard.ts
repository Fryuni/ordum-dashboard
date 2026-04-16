/**
 * Bounty Board — queries and mutations for empire goals, claim goals,
 * and player bounties.
 *
 * Authorization:
 * - Empire goals: managed by officers of the capital claim
 * - Claim goals: managed by officers of that claim
 * - Bounties: any empire member can post (max 10 open), only poster can edit/close
 */
import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ORDUM_EMPIRE_ID } from "./lib/bitjita";
import type { Id } from "./_generated/dataModel";
import { openBountiesAggregate, myClosedBountiesAggregate } from "./aggregates";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPlayerEntityIds(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string[]> {
  const accounts = await ctx.db
    .query("userGameAccounts")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  return accounts.map((a) => a.playerEntityId);
}

async function isEmpireMember(
  ctx: QueryCtx,
  playerEntityIds: string[],
): Promise<boolean> {
  for (const pid of playerEntityIds) {
    const membership = await ctx.db
      .query("claimMembers")
      .filter((q) => q.eq(q.field("playerEntityId"), pid))
      .first();
    if (membership !== null) return true;
  }
  return false;
}

async function isClaimOfficer(
  ctx: QueryCtx,
  playerEntityIds: string[],
  claimId: string,
): Promise<boolean> {
  for (const pid of playerEntityIds) {
    const member = await ctx.db
      .query("claimMembers")
      .withIndex("by_claimId_and_playerEntityId", (q) =>
        q.eq("claimId", claimId).eq("playerEntityId", pid),
      )
      .unique();
    if (member !== null && member.officerPermission) return true;
  }
  return false;
}

async function getCapitalClaimId(ctx: QueryCtx): Promise<string | null> {
  const info = await ctx.db
    .query("empireInfo")
    .withIndex("by_empireId", (q) => q.eq("empireId", ORDUM_EMPIRE_ID))
    .unique();
  return info?.capitalClaimId ?? null;
}

// ─── User Permissions ─────────────────────────────────────────────────────────

export const getUserPermissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const isAdmin = user?.isAdmin === true;

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0)
      return {
        isEmpireMember: false,
        officerClaims: [],
        isCapitalOfficer: false,
        isAdmin,
      };

    const memberships = [];
    for (const pid of playerEntityIds) {
      const m = await ctx.db
        .query("claimMembers")
        .filter((q) => q.eq(q.field("playerEntityId"), pid))
        .collect();
      memberships.push(...m);
    }

    if (memberships.length === 0) {
      return {
        isEmpireMember: false,
        officerClaims: [],
        isCapitalOfficer: false,
        isAdmin,
      };
    }

    const capitalClaimId = await getCapitalClaimId(ctx);
    const officerClaimsSet = new Set<string>();
    let isCapitalOfficer = false;

    for (const m of memberships) {
      if (m.officerPermission) {
        officerClaimsSet.add(m.claimId);
        if (m.claimId === capitalClaimId) {
          isCapitalOfficer = true;
        }
      }
    }

    return {
      isEmpireMember: true,
      officerClaims: [...officerClaimsSet],
      isCapitalOfficer,
      isAdmin,
    };
  },
});

/**
 * Returns the list of game accounts linked to the current user, each with the
 * player name resolved from claimMembers.
 */
export const getMyGameAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const accounts = await ctx.db
      .query("userGameAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const result: Array<{ playerEntityId: string; playerName: string }> = [];
    for (const account of accounts) {
      const member = await ctx.db
        .query("claimMembers")
        .filter((q) => q.eq(q.field("playerEntityId"), account.playerEntityId))
        .first();
      result.push({
        playerEntityId: account.playerEntityId,
        playerName: member?.userName ?? "Unknown",
      });
    }
    return result;
  },
});

// ─── Empire Goals ─────────────────────────────────────────────────────────────

export const listEmpireGoals = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const status = args.status ?? "open";
    return await ctx.db
      .query("empireGoals")
      .withIndex("by_empireId_and_status", (q) =>
        q.eq("empireId", ORDUM_EMPIRE_ID).eq("status", status),
      )
      .collect();
  },
});

export const createEmpireGoal = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    items: v.array(
      v.object({
        itemType: v.string(),
        itemId: v.number(),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    const capitalClaimId = await getCapitalClaimId(ctx);
    if (!capitalClaimId) throw new Error("No capital claim found");

    if (!(await isClaimOfficer(ctx, playerEntityIds, capitalClaimId))) {
      throw new Error("Must be a capital officer to manage empire goals");
    }

    return await ctx.db.insert("empireGoals", {
      empireId: ORDUM_EMPIRE_ID,
      title: args.title,
      description: args.description,
      items: args.items,
      createdBy: userId,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const updateEmpireGoal = mutation({
  args: {
    goalId: v.id("empireGoals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          itemType: v.string(),
          itemId: v.number(),
          quantity: v.number(),
        }),
      ),
    ),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    const capitalClaimId = await getCapitalClaimId(ctx);
    if (!capitalClaimId) throw new Error("No capital claim found");

    if (!(await isClaimOfficer(ctx, playerEntityIds, capitalClaimId))) {
      throw new Error("Must be a capital officer to manage empire goals");
    }

    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");

    const { goalId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.items !== undefined) patch.items = updates.items;
    if (updates.status !== undefined) patch.status = updates.status;

    await ctx.db.patch(args.goalId, patch);
  },
});

export const deleteEmpireGoal = mutation({
  args: { goalId: v.id("empireGoals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    const capitalClaimId = await getCapitalClaimId(ctx);
    if (!capitalClaimId) throw new Error("No capital claim found");

    if (!(await isClaimOfficer(ctx, playerEntityIds, capitalClaimId))) {
      throw new Error("Must be a capital officer to manage empire goals");
    }

    await ctx.db.delete(args.goalId);
  },
});

// ─── Claim Goals ──────────────────────────────────────────────────────────────

export const listClaimGoals = query({
  args: { claimId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const status = args.status ?? "open";
    return await ctx.db
      .query("claimGoals")
      .withIndex("by_claimId_and_status", (q) =>
        q.eq("claimId", args.claimId).eq("status", status),
      )
      .collect();
  },
});

export const createClaimGoal = mutation({
  args: {
    claimId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    items: v.array(
      v.object({
        itemType: v.string(),
        itemId: v.number(),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    if (!(await isClaimOfficer(ctx, playerEntityIds, args.claimId))) {
      throw new Error("Must be a claim officer to manage claim goals");
    }

    return await ctx.db.insert("claimGoals", {
      claimId: args.claimId,
      title: args.title,
      description: args.description,
      items: args.items,
      createdBy: userId,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const updateClaimGoal = mutation({
  args: {
    goalId: v.id("claimGoals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          itemType: v.string(),
          itemId: v.number(),
          quantity: v.number(),
        }),
      ),
    ),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");

    if (!(await isClaimOfficer(ctx, playerEntityIds, goal.claimId))) {
      throw new Error("Must be a claim officer to manage claim goals");
    }

    const { goalId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.items !== undefined) patch.items = updates.items;
    if (updates.status !== undefined) patch.status = updates.status;

    await ctx.db.patch(args.goalId, patch);
  },
});

export const deleteClaimGoal = mutation({
  args: { goalId: v.id("claimGoals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");

    if (!(await isClaimOfficer(ctx, playerEntityIds, goal.claimId))) {
      throw new Error("Must be a claim officer to manage claim goals");
    }

    await ctx.db.delete(args.goalId);
  },
});

// ─── Bounty Entries ───────────────────────────────────────────────────────────

export const PAGE_SIZE = 10;

/**
 * Returns the current user's open bounties (always ≤ 10 so no pagination).
 */
export const listMyOpenBounties = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("bountyEntries")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "open"),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Paginated listing of the current user's closed bounties using the aggregate
 * component. Returns the bounties on the given page plus total-page metadata.
 */
export const listMyClosedBountiesPage = query({
  args: { page: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { bounties: [], page: 0, totalPages: 0, totalCount: 0 };
    }

    const totalCount = await myClosedBountiesAggregate.count(ctx, {
      namespace: userId,
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const page = Math.max(0, Math.min(args.page, totalPages - 1));
    const offset = page * PAGE_SIZE;

    // Aggregate is sorted by creation time ascending; read in descending order
    // so newest bounty is at the top of page 0.
    const pageSize = Math.min(PAGE_SIZE, Math.max(0, totalCount - offset));
    const atQueries = Array.from({ length: pageSize }, (_, i) => ({
      namespace: userId,
      offset: offset + i,
      order: "desc" as const,
    }));
    const items = atQueries.length
      ? await myClosedBountiesAggregate.atBatch(ctx, atQueries)
      : [];

    const bounties = [];
    for (const item of items) {
      const doc = await ctx.db.get(item.id);
      if (doc) bounties.push(doc);
    }

    return { bounties, page, totalPages, totalCount };
  },
});

/**
 * Paginated listing of all open bounties (public). Excludes the current
 * user's bounties so they aren't duplicated with the "My Bounties" section.
 *
 * Each user can post at most 10 open bounties, so over-fetching by 10 is
 * sufficient to fill a page after exclusion.
 */
export const listOpenBountiesPage = query({
  args: { page: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const totalCount = await openBountiesAggregate.count(ctx);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const page = Math.max(0, Math.min(args.page, totalPages - 1));
    const offset = page * PAGE_SIZE;

    // Over-fetch by 10 to compensate for excluding the current user's (up to 10)
    // bounties. Newest first via order="desc".
    const fetchSize = Math.min(
      PAGE_SIZE + 10,
      Math.max(0, totalCount - offset),
    );
    const atQueries = Array.from({ length: fetchSize }, (_, i) => ({
      offset: offset + i,
      order: "desc" as const,
    }));
    const items = atQueries.length
      ? await openBountiesAggregate.atBatch(ctx, atQueries)
      : [];

    const bounties = [];
    for (const item of items) {
      if (bounties.length >= PAGE_SIZE) break;
      const doc = await ctx.db.get(item.id);
      if (!doc) continue;
      if (userId && doc.userId === userId) continue;
      bounties.push(doc);
    }

    return { bounties, page, totalPages, totalCount };
  },
});

export const createBounty = mutation({
  args: {
    playerEntityId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    items: v.array(
      v.object({
        itemType: v.string(),
        itemId: v.number(),
        quantity: v.number(),
      }),
    ),
    priceHex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const playerEntityIds = await getPlayerEntityIds(ctx, userId);
    if (playerEntityIds.length === 0) throw new Error("No game account linked");

    // Validate the selected character belongs to the authenticated user
    if (!playerEntityIds.includes(args.playerEntityId)) {
      throw new Error("Selected character is not linked to your account");
    }

    if (!(await isEmpireMember(ctx, [args.playerEntityId]))) {
      throw new Error("Selected character is not an empire member");
    }

    // Check max 10 open bounties
    const openBounties = await ctx.db
      .query("bountyEntries")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "open"),
      )
      .collect();

    if (openBounties.length >= 10) {
      throw new Error("Maximum of 10 open bounties reached");
    }

    // Resolve player name from claimMembers for the selected character
    const memberRecord = await ctx.db
      .query("claimMembers")
      .filter((q) => q.eq(q.field("playerEntityId"), args.playerEntityId))
      .first();

    const bountyId = await ctx.db.insert("bountyEntries", {
      userId,
      playerName: memberRecord?.userName ?? "Unknown",
      title: args.title,
      description: args.description,
      items: args.items,
      priceHex: args.priceHex,
      status: "open",
      createdAt: Date.now(),
    });

    const doc = await ctx.db.get(bountyId);
    if (doc) await openBountiesAggregate.insert(ctx, doc);

    return bountyId;
  },
});

export const updateBounty = mutation({
  args: {
    bountyId: v.id("bountyEntries"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    items: v.optional(
      v.array(
        v.object({
          itemType: v.string(),
          itemId: v.number(),
          quantity: v.number(),
        }),
      ),
    ),
    priceHex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bounty = await ctx.db.get(args.bountyId);
    if (!bounty) throw new Error("Bounty not found");
    if (bounty.userId !== userId)
      throw new Error("Can only edit your own bounties");

    const { bountyId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.items !== undefined) patch.items = updates.items;
    if (updates.priceHex !== undefined) patch.priceHex = updates.priceHex;

    await ctx.db.patch(args.bountyId, patch);
  },
});

export const closeBounty = mutation({
  args: { bountyId: v.id("bountyEntries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bounty = await ctx.db.get(args.bountyId);
    if (!bounty) throw new Error("Bounty not found");
    if (bounty.userId !== userId)
      throw new Error("Can only close your own bounties");
    if (bounty.status !== "open") return;

    await ctx.db.patch(args.bountyId, { status: "closed" });
    const updated = await ctx.db.get(args.bountyId);
    if (updated) {
      await openBountiesAggregate.delete(ctx, bounty);
      await myClosedBountiesAggregate.insert(ctx, updated);
    }
  },
});

/**
 * One-time backfill of the aggregates with existing bounty data. Safe to run
 * multiple times — uses insertIfDoesNotExist so duplicates are ignored.
 */
export const backfillAggregates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("bountyEntries").collect();
    for (const bounty of all) {
      if (bounty.status === "open") {
        await openBountiesAggregate.insertIfDoesNotExist(ctx, bounty);
      } else if (bounty.status === "closed") {
        await myClosedBountiesAggregate.insertIfDoesNotExist(ctx, bounty);
      }
    }
    return { count: all.length };
  },
});

// ─── Dashboard Goals (for embedding in dashboard) ─────────────────────────────

export const getDashboardGoals = query({
  args: {},
  handler: async (ctx) => {
    const empireGoals = await ctx.db
      .query("empireGoals")
      .withIndex("by_empireId_and_status", (q) =>
        q.eq("empireId", ORDUM_EMPIRE_ID).eq("status", "open"),
      )
      .collect();

    // Get all claims for this empire to fetch claim goals
    const claims = await ctx.db
      .query("empireClaims")
      .withIndex("by_empireId", (q) => q.eq("empireId", ORDUM_EMPIRE_ID))
      .collect();

    const claimGoalsMap: Record<
      string,
      Array<{
        _id: string;
        title: string;
        description?: string;
        items: Array<{ itemType: string; itemId: number; quantity: number }>;
      }>
    > = {};

    for (const claim of claims) {
      const goals = await ctx.db
        .query("claimGoals")
        .withIndex("by_claimId_and_status", (q) =>
          q.eq("claimId", claim.claimId).eq("status", "open"),
        )
        .collect();
      if (goals.length > 0) {
        claimGoalsMap[claim.claimId] = goals.map((g) => ({
          _id: g._id,
          title: g.title,
          description: g.description,
          items: g.items,
        }));
      }
    }

    return {
      empireGoals: empireGoals.map((g) => ({
        _id: g._id,
        title: g.title,
        description: g.description,
        items: g.items,
      })),
      claimGoals: claimGoalsMap,
    };
  },
});
