import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  // ─── Storage Audit ──────────────────────────────────────────────────────────
  // Migrated from D1 storage_logs table
  storageLogs: defineTable({
    logId: v.string(), // original BitJita log ID (dedupe key)
    claimId: v.string(),
    playerEntityId: v.string(),
    playerName: v.string(),
    buildingEntityId: v.string(),
    buildingName: v.string(),
    itemType: v.string(), // "Item" | "Cargo"
    itemId: v.number(),
    itemName: v.string(),
    quantity: v.number(),
    unitValue: v.number(),
    action: v.string(), // "deposit" | "withdraw"
    timestamp: v.string(), // ISO string from BitJita
  })
    .index("by_logId", ["logId"])
    .index("by_claimId_and_timestamp", ["claimId", "timestamp"])
    .index("by_claimId_and_playerEntityId_and_timestamp", [
      "claimId",
      "playerEntityId",
      "timestamp",
    ])
    .index("by_claimId_and_item_and_timestamp", [
      "claimId",
      "itemId",
      "itemType",
      "timestamp",
    ]),

  // Tracks ingestion progress per building (migrated from D1 storage_fetch_state)
  storageFetchState: defineTable({
    claimId: v.string(),
    buildingEntityId: v.string(),
    newestLogId: v.optional(v.string()),
    updatedAt: v.optional(v.number()), // epoch ms
  })
    .index("by_claimId_and_buildingEntityId", ["claimId", "buildingEntityId"])
    .index("by_update_time", ["updatedAt"]),

  // ─── Empire Data (synced from BitJita) ────────────────────────────────────

  // Empire-level metadata (one row per empire)
  empireInfo: defineTable({
    empireId: v.string(),
    name: v.optional(v.string()),
    hexiteReserve: v.number(),
    capitalClaimId: v.optional(v.string()),
    syncedAt: v.number(),
  }).index("by_empireId", ["empireId"]),

  // Claims belonging to an empire
  empireClaims: defineTable({
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
    syncedAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_empireId", ["empireId"]),

  // Members of each claim
  claimMembers: defineTable({
    claimId: v.string(),
    playerEntityId: v.string(),
    userName: v.string(),
    inventoryPermission: v.boolean(),
    buildPermission: v.boolean(),
    officerPermission: v.boolean(),
    coOwnerPermission: v.boolean(),
    syncedAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_claimId_and_playerEntityId", ["claimId", "playerEntityId"]),

  // Building inventories (one doc per building, excluding bank buildings)
  buildingInventories: defineTable({
    claimId: v.string(),
    buildingEntityId: v.string(),
    buildingDescriptionId: v.number(),
    buildingName: v.string(),
    buildingNickname: v.optional(v.string()),
    items: v.array(
      v.object({
        itemType: v.string(), // "Item" | "Cargo"
        itemId: v.number(),
        quantity: v.number(),
      }),
    ),
    syncedAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_claimId_and_buildingEntityId", ["claimId", "buildingEntityId"]),

  // Active/passive crafts in a claim
  claimCrafts: defineTable({
    claimId: v.string(),
    recipeId: v.number(),
    buildingName: v.string(),
    craftCount: v.number(),
    progress: v.number(),
    totalActionsRequired: v.number(),
    ownerEntityId: v.string(),
    ownerUsername: v.string(),
    isPassive: v.boolean(),
    syncedAt: v.number(),
  }).index("by_claimId", ["claimId"]),

  // Active construction projects in a claim
  constructionProjects: defineTable({
    claimId: v.string(),
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
    syncedAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_claimId_and_projectEntityId", ["claimId", "projectEntityId"]),
});
