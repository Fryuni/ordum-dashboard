/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
/**
 * Craft planner — user-saved plans and curated presets.
 */
import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { ItemReference } from "../src/common/gamedata/definition.ts";
import { requireUser } from "./lib/user";
import type { Id } from "./_generated/dataModel";

const MAX_PLANS_PER_USER = 1000;
const LIST_PAGE_SIZE = 100;

const targetValidator = v.object({
  item_id: v.number(),
  item_type: v.union(v.literal("Item"), v.literal("Cargo")),
  name: v.string(),
  quantity: v.number(),
});

const virtualInventoryValidator = v.array(
  v.object({
    key: v.string(), // "ItemType:itemId"
    places: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
      }),
    ),
  }),
);

interface PresetPlan {
  name: string;
  targets: Array<
    ItemReference & {
      quantity: number;
    }
  >;
}

export const listMine = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const searchTerm = args.search?.trim() ?? "";

    if (searchTerm.length > 0) {
      return await ctx.db
        .query("craftPlans")
        .withSearchIndex("by_name", (q) =>
          q.search("name", searchTerm).eq("userId", userId),
        )
        .take(LIST_PAGE_SIZE);
    }

    return await ctx.db
      .query("craftPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_PAGE_SIZE);
  },
});

export const listPresets = query({
  args: {},
  handler: async (ctx): Promise<PresetPlan[]> => {
    // TODO: populate with curated starter plans.
    return [];
  },
});

export const savePlan = mutation({
  args: {
    name: v.string(),
    targets: v.array(targetValidator),
    virtualInventory: virtualInventoryValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const name = args.name.trim();
    if (name.length === 0) throw new Error("Plan name cannot be empty");

    const now = Date.now();

    const existing = await ctx.db
      .query("craftPlans")
      .withIndex("by_userId_and_name", (q) =>
        q.eq("userId", userId).eq("name", name),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        targets: args.targets,
        virtualInventory: args.virtualInventory,
        updatedAt: now,
      });
      return existing._id;
    }

    const existingPlans = await ctx.db
      .query("craftPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_PLANS_PER_USER);

    if (existingPlans.length >= MAX_PLANS_PER_USER) {
      throw new Error(
        `Plan limit reached (${MAX_PLANS_PER_USER}). Delete old plans to save new ones.`,
      );
    }

    return await ctx.db.insert("craftPlans", {
      userId,
      name,
      targets: args.targets,
      virtualInventory: args.virtualInventory,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deletePlan = mutation({
  args: {
    planId: v.id("craftPlans"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.userId !== userId) throw new Error("Not your plan");

    await ctx.db.delete(args.planId);
  },
});

async function ensurePlannerConfigState(
  ctx: MutationCtx,
): Promise<Id<"plannerConfigState">> {
  const user = await requireUser(ctx);
  const configState = await ctx.db
    .query("plannerConfigState")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if (!configState) {
    const id = await ctx.db.insert("plannerConfigState", {
      userId: user._id,
      playerEntityId: null,
    });
    return id;
  }
  return configState._id;
}

export const selectPlayer = mutation({
  args: {
    playerEntityId: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    const plannerState = await ensurePlannerConfigState(ctx);
    await ctx.db.patch(plannerState, {
      playerEntityId: args.playerEntityId,
    });
  },
});
