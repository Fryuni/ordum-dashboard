/**
 * Public-facing sync trigger for on-demand storage audit ingestion.
 * Schedules ingestion to run immediately without blocking the caller.
 */
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
export const triggerIngestion = action({
    args: {},
    handler: async (ctx) => {
        await ctx.scheduler.runAfter(0, internal.storageAuditIngestion.ingestAll, {});
        return { scheduled: true };
    },
});
