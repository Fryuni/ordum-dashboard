/**
 * Construction data — Convex action that calls BitJita API.
 * Migrated from /api/construction route.
 *
 * Note: construction recipe resolution uses game data which is available
 * in the client bundle. We return raw data + recipe matches and let the
 * client do the final formatting (it already has gd.constructionRecipes).
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import * as jita from "./lib/bitjita";
export const getConstruction = action({
    args: {
        claimId: v.string(),
    },
    handler: async (_ctx, args) => {
        const [constructionData, claimInv] = await Promise.all([
            jita.getClaimConstruction(args.claimId),
            jita.getClaimInventories(args.claimId),
        ]);
        // Return raw data for client-side processing with game data
        return {
            projects: constructionData.projects ?? [],
            constructionItems: [
                ...(constructionData.items ?? []),
                ...(claimInv.items ?? []),
            ],
            constructionCargos: [
                ...(constructionData.cargos ?? []),
                ...(claimInv.cargos ?? []),
            ],
        };
    },
});
