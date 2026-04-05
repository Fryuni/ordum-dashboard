/**
 * Public-facing sync trigger for on-demand storage audit ingestion.
 */
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
export const triggerIngestion = action({
    args: {},
    handler: async (ctx) => {
        await ctx.runAction(internal.storageAuditIngestion.ingestAll, {});
        return { ingested: true };
    },
});
