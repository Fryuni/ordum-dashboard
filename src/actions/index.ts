import { defineAction, ActionError } from "astro:actions";
import { z } from "astro/zod";
import { loadGameData } from "../lib/gamedata";
import { buildCraftPlan, searchItems, type CraftTarget } from "../lib/craft-planner";
import { API_BASE_URL } from "../lib/ordum-data";

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
          const playersResp = await fetch(
            `${API_BASE_URL}/players?search=${encodeURIComponent(player)}&per_page=5`,
            { headers: { Accept: "application/json" } },
          );
          const playersData = await playersResp.json();
          const found = playersData.players?.find(
            (p: any) => p.username?.toLowerCase() === player.toLowerCase(),
          );

          if (found) {
            playerInfo = {
              entity_id: found.entity_id,
              username: found.username,
              signed_in: found.signed_in,
            };

            const pockets = found.pockets ?? [];
            for (const pocket of pockets) {
              if (pocket?.contents) {
                const c = pocket.contents;
                const key = `${c.item_type ?? "Item"}:${c.item_id}`;
                inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 1));
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
