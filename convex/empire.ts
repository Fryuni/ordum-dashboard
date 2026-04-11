/**
 * Empire — lightweight live-data actions.
 *
 * Most empire data now lives in Convex tables (synced by empireSync.ts)
 * and is served by queries in empireData.ts. This file only contains
 * actions that need live BitJita data that can't be synced.
 */
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as jita from "./lib/bitjita";

/**
 * Get the count of currently online members across all empire claims.
 * This is the only dashboard data that still comes live from BitJita.
 */
export const getOnlineCount = action({
  args: {},
  handler: async (ctx) => {
    // Read all member entity IDs from the DB
    const claims = await ctx.runQuery(
      internal.empireData.getAllMemberEntityIds,
      {},
    );

    let onlineCount = 0;
    for (const entityId of claims) {
      try {
        const buffs = await jita.getPlayerBuffs(entityId);
        if (buffs.isOnline) onlineCount++;
      } catch {
        // Skip members whose status can't be fetched
      }
    }

    return { onlineCount };
  },
});
