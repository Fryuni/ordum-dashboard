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
    .index("by_claimId_and_itemId_and_itemType_and_timestamp", [
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
  }).index("by_claimId_and_buildingEntityId", ["claimId", "buildingEntityId"]),
});
