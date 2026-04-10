/**
 * Empire Data Sync — fetches all empire/claim data from BitJita
 * and writes it to Convex tables via internal mutations.
 *
 * Called by the cron job every 5 minutes and on-demand via sync trigger.
 */
import { ActionCtx, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import * as jita from "./lib/bitjita";

/** Building description IDs for bank buildings (personal storage) */
const BANK_BUILDING_IDS = new Set([
  985246037, // Town Bank
  1615467546, // Ancient Bank
  969744821, // Lost Items Chest
]);

export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const empires = await ctx.runQuery(api.empireData.getEmpires);

    for (const { id: empireId, name } of empires) {
      // 1. Fetch empire info
      const { empire } = await jita.getEmpire(empireId);
      if (!empire) {
        console.error(`Unknown empire ${empireId}`);
        return
      }

      const hexiteReserve =
        Number(empire.empireCurrencyTreasury) ||
        Number(empire.shardTreasury) ||
        0;
      const capitalBuildingEntityId = empire.capitalBuildingEntityId ?? null;

      // 2. Fetch empire claims
      let rawClaims: Array<{ entityId: string; name: string }> = [];
      try {
        const claimsData = await jita.getEmpireClaims(empireId);
        rawClaims = (claimsData.claims as any[]).map((cl: any) => ({
          entityId: cl.entityId as string,
          name: cl.name as string,
        }));
      } catch (err) {
        console.error("[empire-sync] Failed to fetch empire claims:", err);
        return;
      }

      const claimIds = rawClaims.map((c) => c.entityId);

      // 3. Sync each claim, collecting ownerBuildingEntityIds for capital resolution
      const claimOwners = new Map<string, string>();
      for (const rawClaim of rawClaims) {
        const claimId = rawClaim.entityId;
        try {
          const ownerBuildingEntityId = await syncClaimData(
            ctx,
            empireId,
            claimId,
          );
          if (ownerBuildingEntityId) {
            claimOwners.set(claimId, ownerBuildingEntityId);
          }
        } catch (err) {
          console.error(`[empire-sync] Failed to sync claim ${claimId}:`, err);
        }
      }

      // Resolve capital claim ID
      let capitalClaimId: string | undefined;
      if (capitalBuildingEntityId) {
        for (const [claimId, ownerBld] of claimOwners) {
          if (ownerBld === capitalBuildingEntityId) {
            capitalClaimId = claimId;
            break;
          }
        }
      }
      if (!capitalClaimId && claimIds.length > 0) {
        capitalClaimId = claimIds[0];
      }

      await ctx.runMutation(internal.empireData.upsertEmpireInfo, {
        empireId,
        name: empire.name ?? name,
        hexiteReserve,
        capitalClaimId,
      });

      // 5. Remove stale claims
      await ctx.runMutation(internal.empireData.removeStaleClaimData, {
        empireId,
        activeClaimIds: claimIds,
      });

      console.log(`[empire-sync] Completed: ${claimIds.length} claims synced`);
    }
  },
});

/** Syncs all data for one claim. Returns the ownerBuildingEntityId. */
async function syncClaimData(
  ctx: ActionCtx,
  empireId: string,
  claimId: string,
): Promise<string | null> {
  // Fetch claim details, members, inventories in parallel
  const [{ claim }, claimMembers, claimInv] = await Promise.all([
    jita.getClaim(claimId),
    jita.getClaimMembers(claimId),
    jita.getClaimInventories(claimId),
  ]);

  const ownerBuildingEntityId: string = claim.ownerBuildingEntityId ?? "";

  // Sync claim metadata
  await ctx.runMutation(internal.empireData.syncClaim, {
    empireId,
    claimId,
    name: claim.name ?? "Unknown",
    region: claim.regionName ?? "Unknown",
    tier: claim.tier != null ? Number(claim.tier) : undefined,
    supplies: Number(claim.supplies) || 0,
    treasury: Number(claim.treasury) || 0,
    numTiles: claim.numTiles ?? 0,
    buildingCount: (claimInv.buildings ?? []).length,
    ownerBuildingEntityId,
    learnedTechIds: (claim.researchedTechs ?? []).map((t: any) => Number(t.id)),
    locationX: claim.locationX,
    locationZ: claim.locationZ,
  });

  // Sync members
  const members = (claimMembers.members ?? []).map((m: any) => ({
    playerEntityId: String(m.playerEntityId),
    userName: m.userName ?? "Unknown",
    inventoryPermission: m.inventoryPermission === 1,
    buildPermission: m.buildPermission === 1,
    officerPermission: m.officerPermission === 1,
    coOwnerPermission: m.coOwnerPermission === 1,
  }));
  await ctx.runMutation(internal.empireData.syncClaimMembers, {
    claimId,
    members,
  });

  // Sync building inventories (excluding bank buildings)
  const buildings = (claimInv.buildings ?? [])
    .filter((b: any) => !BANK_BUILDING_IDS.has(b.buildingDescriptionId))
    .map((b: any) => ({
      buildingEntityId: String(b.entityId),
      buildingDescriptionId: b.buildingDescriptionId,
      buildingName: b.buildingName ?? "Unknown Building",
      buildingNickname: b.buildingNickname ?? undefined,
      items: (b.inventory ?? [])
        .filter(
          (pocket: any) => pocket.contents && pocket.contents.quantity > 0,
        )
        .map((pocket: any) => ({
          itemType: pocket.contents.item_type === "cargo" ? "Cargo" : "Item",
          itemId: pocket.contents.item_id,
          quantity: pocket.contents.quantity,
        })),
    }));
  await ctx.runMutation(internal.empireData.syncBuildingInventories, {
    claimId,
    buildings,
  });

  // Sync active crafts
  const crafts: Array<{
    recipeId: number;
    buildingName: string;
    craftCount: number;
    progress: number;
    totalActionsRequired: number;
    ownerEntityId: string;
    ownerUsername: string;
    isPassive: boolean;
  }> = [];

  try {
    const [{ craftResults: completed }, { craftResults: ongoing }] =
      await Promise.all([
        jita.listCrafts({
          claimEntityId: claim.entityId,
          regionId: claim.regionId,
          completed: true,
        }),
        jita.listCrafts({
          claimEntityId: claim.entityId,
          regionId: claim.regionId,
          completed: false,
        }),
      ]);

    for (const craft of [...completed, ...ongoing]) {
      crafts.push({
        recipeId: craft.recipeId,
        buildingName: craft.buildingName ?? "Unknown",
        craftCount: craft.craftCount ?? 1,
        progress: craft.progress ?? 0,
        totalActionsRequired: craft.totalActionsRequired ?? 0,
        ownerEntityId: String(craft.ownerEntityId),
        ownerUsername: craft.ownerUsername ?? "Unknown",
        isPassive: false,
      });
    }
  } catch (err) {
    console.error(`[empire-sync] Failed to fetch crafts for ${claimId}:`, err);
  }

  // Sync passive crafts for all members
  for (const member of members) {
    try {
      const passiveData = await jita.getPlayerPassiveCrafts(
        member.playerEntityId,
      );
      for (const craft of passiveData.craftResults ?? []) {
        // Only include passive crafts belonging to this claim
        if (craft.claimEntityId !== claimId) continue;
        crafts.push({
          recipeId: craft.recipeId,
          buildingName: craft.buildingName ?? "Unknown",
          craftCount: 1,
          progress: craft.status === "complete" ? 1 : 0,
          totalActionsRequired: 1,
          ownerEntityId: String(craft.ownerEntityId),
          ownerUsername: member.userName,
          isPassive: true,
        });
      }
    } catch (err) {
      console.error(
        `[empire-sync] Failed to fetch passive crafts for ${member.playerEntityId}:`,
        err,
      );
    }
  }

  await ctx.runMutation(internal.empireData.syncClaimCrafts, {
    claimId,
    crafts,
  });

  // Sync construction projects
  try {
    const constructionData = (await jita.getClaimConstruction(claimId)) as any;
    const projects = (constructionData.projects ?? []).map((p: any) => ({
      projectEntityId: String(p.entityId ?? ""),
      buildingName: p.buildingName ?? "Unknown",
      buildingNickname: p.buildingNickname ?? undefined,
      constructionRecipeId: p.constructionRecipeId ?? 0,
      depositedItems: (p.inventory ?? [])
        .filter(
          (pocket: any) => pocket.contents && pocket.contents.quantity > 0,
        )
        .map((pocket: any) => ({
          itemType: pocket.contents.item_type === "cargo" ? "Cargo" : "Item",
          itemId: pocket.contents.item_id,
          quantity: pocket.contents.quantity,
        })),
    }));
    await ctx.runMutation(internal.empireData.syncConstructionProjects, {
      claimId,
      projects,
    });
  } catch (err) {
    console.error(
      `[empire-sync] Failed to fetch construction for ${claimId}:`,
      err,
    );
  }

  return ownerBuildingEntityId || null;
}
