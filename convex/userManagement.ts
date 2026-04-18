/**
 * User management — admin-only queries and mutations for linking signed-in
 * users to their in-game characters via the userGameAccounts table.
 */
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/user";

/**
 * List all users with their linked in-game characters.
 */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const result = [];
    for (const u of users) {
      const accounts = await ctx.db
        .query("userGameAccounts")
        .filter((q) => q.eq(q.field("userId"), u._id))
        .collect();

      const linkedCharacters: Array<{
        _id: Id<"userGameAccounts">;
        playerEntityId: string;
        playerName: string;
      }> = [];
      for (const acc of accounts) {
        const member = await ctx.db
          .query("claimMembers")
          .filter((q) => q.eq(q.field("playerEntityId"), acc.playerEntityId))
          .first();
        linkedCharacters.push({
          _id: acc._id,
          playerEntityId: acc.playerEntityId,
          playerName: member?.userName ?? "Unknown",
        });
      }

      result.push({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        isAdmin: u.isAdmin === true,
        linkedCharacters,
      });
    }
    // Sort: admins first, then by name
    result.sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
    });
    return result;
  },
});

/**
 * Search claim members by name for linking. Deduplicates by playerEntityId
 * (the same player may appear in multiple claims).
 */
export const searchCharacters = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const q = args.query.trim().toLowerCase();
    if (q.length < 2) return [];

    const members = await ctx.db.query("claimMembers").collect();
    const seen = new Set<string>();
    const linked = new Set<string>(
      (await ctx.db.query("userGameAccounts").collect()).map(
        (a) => a.playerEntityId,
      ),
    );

    const matches: Array<{
      playerEntityId: string;
      userName: string;
      alreadyLinked: boolean;
    }> = [];
    for (const m of members) {
      if (seen.has(m.playerEntityId)) continue;
      if (!m.userName.toLowerCase().includes(q)) continue;
      seen.add(m.playerEntityId);
      matches.push({
        playerEntityId: m.playerEntityId,
        userName: m.userName,
        alreadyLinked: linked.has(m.playerEntityId),
      });
      if (matches.length >= 20) break;
    }
    matches.sort((a, b) => a.userName.localeCompare(b.userName));
    return matches;
  },
});

/**
 * Link an in-game character to a user. Fails if the character is already
 * linked to any user.
 */
export const linkCharacter = mutation({
  args: {
    userId: v.id("users"),
    playerEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("userGameAccounts")
      .filter((q) => q.eq(q.field("playerEntityId"), args.playerEntityId))
      .first();
    if (existing) {
      throw new Error("Character is already linked to a user");
    }

    // Verify the target user exists
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    await ctx.db.insert("userGameAccounts", {
      userId: args.userId,
      playerEntityId: args.playerEntityId,
    });
  },
});

/**
 * Remove an in-game character link.
 */
export const unlinkCharacter = mutation({
  args: { accountId: v.id("userGameAccounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.accountId);
  },
});

/**
 * Bootstrap an admin by user ID. Meant for seeding the first admin only —
 * once there's an admin, use setUserAdmin instead.
 *
 * Run via: `npx convex run userManagement:bootstrapAdmin '{"userId":"..."}'`
 */
export const bootstrapAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { isAdmin: true });
  },
});

/**
 * Toggle a user's admin status.
 */
export const setUserAdmin = mutation({
  args: { userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    const { _id: callerId } = await requireAdmin(ctx);
    // Prevent admins from accidentally demoting themselves while there are no
    // other admins left.
    if (callerId === args.userId && !args.isAdmin) {
      const allUsers = await ctx.db.query("users").collect();
      const otherAdmins = allUsers.filter(
        (u) => u._id !== callerId && u.isAdmin === true,
      );
      if (otherAdmins.length === 0) {
        throw new Error("Cannot remove the last admin");
      }
    }
    await ctx.db.patch(args.userId, { isAdmin: args.isAdmin });
  },
});
