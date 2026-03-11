import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { loadGameData } from "../lib/gamedata";
import { buildCraftPlan, searchItems, type CraftTarget } from "../lib/craft-planner";
import { api } from "../lib/api";
import { ORDUM_MAIN_CLAIM_ID } from "../lib/ordum-data";

const gd = loadGameData();

export const server = {
  searchItems: defineAction({
    input: z.object({
      query: z.string().min(2),
    }),
    handler: async ({ query }) => {
      return searchItems(gd, query, 20);
    },
  }),

  craftPlan: defineAction({
    input: z.object({
      player: z.string().optional().default(""),
      items: z.array(z.object({
        id: z.int(),
        type: z.enum(['Item', 'Cargo']),
        quantity: z.int(),
      }))
    }),
    handler: async ({ player, items }) => {
      const targets = items.map((item): CraftTarget => ({
        item_type: item.type,
        item_id: item.id,
        quantity: item.quantity,
      }));

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
          // Use claim data for inventory — the /players endpoint doesn't include it.
          // The claim endpoint has member inventories and building storage.
          const claim = await api.getClaim(ORDUM_MAIN_CLAIM_ID);
          const members = claim.members ?? {};
          const found = Object.values(members).find(
            (m: any) => m.user_name?.toLowerCase() === player.toLowerCase(),
          ) as any;

          if (found) {
            playerInfo = {
              entity_id: found.entity_id,
              username: found.user_name,
              signed_in: found.online_state === "Online",
            };

            // 1. Player's carried inventory (pockets)
            const pockets = found.inventory?.pockets ?? [];
            for (const pocket of pockets) {
              if (pocket?.contents) {
                const c = pocket.contents;
                const key = `${c.item_type ?? "Item"}:${c.item_id}`;
                inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 1));
              }
            }

            // 2. Items stored in claim buildings (Town Bank, stockpiles, carts, etc.)
            //    attributed to this player via player_owner_entity_id
            const invLoc = (claim as any).inventory_locations ?? {};
            const playerEntityId = found.entity_id;
            for (const section of [invLoc.players, invLoc.players_offline, invLoc.buildings]) {
              for (const loc of section ?? []) {
                for (const l of loc.locations ?? []) {
                  if (l.player_owner_entity_id === playerEntityId) {
                    const key = `${loc.item_type ?? "Item"}:${loc.item_id}`;
                    inventory.set(key, (inventory.get(key) ?? 0) + (l.quantity ?? 0));
                  }
                }
              }
            }
          }
        } catch {
          // Continue without player data
        }
      }

      const plans = buildCraftPlan(gd, targets, inventory);

      return {
        player: playerInfo,
        inventory_size: inventory.size,
        plans,
      };
    },
  }),
};
