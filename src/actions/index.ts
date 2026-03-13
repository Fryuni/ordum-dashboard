import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import {
  buildCraftPlan,
  searchItems,
  type CraftTarget,
} from "../lib/craft-planner";
import { api } from "../lib/api";
import { ORDUM_MAIN_CLAIM_ID } from "../lib/ordum-data";
import { buildClaimInventory } from "../lib/claim-inventory";

export const server = {
  groupCraftPlan: defineAction({
    input: z.object({
      items: z.array(
        z.object({
          id: z.int(),
          type: z.enum(["Item", "Cargo"]),
          quantity: z.int(),
        }),
      ),
    }),
    handler: async ({ items }) => {
      const targets = items.map(
        (item): CraftTarget => ({
          item_type: item.type,
          item_id: item.id,
          quantity: item.quantity,
        }),
      );

      if (targets.length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No valid items specified",
        });
      }

      // Build inventory from the Ordum claim (excludes bank buildings — personal storage)
      let inventory = new Map<string, number>();
      try {
        const claim = await api.getClaim(ORDUM_MAIN_CLAIM_ID);
        inventory = buildClaimInventory(claim);
      } catch {
        // Continue with empty inventory
      }

      const plan = buildCraftPlan(targets, inventory);

      return {
        player: null,
        inventory_size: inventory.size,
        plan,
      };
    },
  }),

  searchItems: defineAction({
    input: z.object({
      query: z.string().min(2),
    }),
    handler: async ({ query }) => {
      return searchItems(query, 20);
    },
  }),

  craftPlan: defineAction({
    input: z.object({
      player: z.string().optional().default(""),
      items: z.array(
        z.object({
          id: z.int(),
          type: z.enum(["Item", "Cargo"]),
          quantity: z.int(),
        }),
      ),
    }),
    handler: async ({ player, items }) => {
      const targets = items.map(
        (item): CraftTarget => ({
          item_type: item.type,
          item_id: item.id,
          quantity: item.quantity,
        }),
      );

      if (targets.length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No valid items specified",
        });
      }

      // Fetch player inventory if player name provided
      const inventory = new Map<string, number>();
      let playerInfo: {
        entity_id: number;
        username: string;
        signed_in: boolean;
      } | null = null;

      if (player) {
        try {
          // Look up player in the claim to get entity_id and online state.
          // Members object keys are exact entity ID strings (safe from precision loss),
          // while the entity_id number field can exceed MAX_SAFE_INTEGER.
          const claim = await api.getClaim(ORDUM_MAIN_CLAIM_ID);
          const members = claim.members ?? {};
          let memberEntityId: string | undefined;
          let found: any;
          for (const [key, m] of Object.entries(members)) {
            if ((m as any).user_name?.toLowerCase() === player.toLowerCase()) {
              memberEntityId = key;
              found = m;
              break;
            }
          }

          if (found && memberEntityId) {
            playerInfo = {
              entity_id: found.entity_id,
              username: found.user_name,
              signed_in: found.online_state === "Online",
            };

            // Fetch ALL inventories owned by this player via the inventorys endpoint.
            // This returns personal inventory, tool belt, wallet, AND deployables
            // (carts, rafts, etc.) — everything the player owns.
            // Use the string key to avoid number precision loss.
            const invData =
              await api.findInventoryByOwnerEntityId(memberEntityId);
            for (const inv of invData.inventorys ?? []) {
              for (const pocket of inv.pockets ?? []) {
                const p = pocket as any;
                if (p?.contents) {
                  const c = p.contents;
                  const key = `${c.item_type ?? "Item"}:${c.item_id}`;
                  inventory.set(
                    key,
                    (inventory.get(key) ?? 0) + (c.quantity ?? 1),
                  );
                }
              }
            }
          }
        } catch {
          // Continue without player data
        }
      }

      try {
        const plan = buildCraftPlan(targets, inventory);

        return {
          player: playerInfo,
          inventory_size: inventory.size,
          plan,
        };
      } catch (error) {
        console.error('Error making plan:', error);
        throw error;
      }
    },
  }),
};
