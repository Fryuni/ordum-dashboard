import type { APIRoute } from "astro";
import { loadGameData } from "../../lib/gamedata";
import { buildCraftPlan, type CraftTarget } from "../../lib/craft-planner";
import { API_BASE_URL } from "../../lib/ordum-data";

const gd = loadGameData();

export const GET: APIRoute = async ({ url }) => {
  const playerName = url.searchParams.get("player") ?? "";
  const itemsParam = url.searchParams.get("items") ?? ""; // Format: "Item:123:5,Cargo:456:10"

  // Parse target items
  const targets: CraftTarget[] = [];
  for (const part of itemsParam.split(",").filter(Boolean)) {
    const [itemType, itemIdStr, qtyStr] = part.split(":");
    if (itemType && itemIdStr && qtyStr) {
      targets.push({
        item_type: itemType as "Item" | "Cargo",
        item_id: parseInt(itemIdStr),
        quantity: parseInt(qtyStr),
      });
    }
  }

  if (targets.length === 0) {
    return new Response(JSON.stringify({ error: "No items specified" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch player inventory if player name provided
  const inventory = new Map<string, number>();
  let playerInfo: any = null;

  if (playerName) {
    try {
      // Search for the player
      const playersResp = await fetch(
        `${API_BASE_URL}/players?search=${encodeURIComponent(playerName)}&per_page=5`,
        { headers: { Accept: "application/json" } },
      );
      const playersData = await playersResp.json();
      const player = playersData.players?.find(
        (p: any) => p.username?.toLowerCase() === playerName.toLowerCase(),
      );

      if (player) {
        playerInfo = {
          entity_id: player.entity_id,
          username: player.username,
          signed_in: player.signed_in,
        };

        // Get the player's inventory from their pockets
        // Also check claim data for their inventory
        const pockets = player.pockets ?? [];
        for (const pocket of pockets) {
          if (pocket?.contents) {
            const c = pocket.contents;
            const key = `${c.item_type ?? "Item"}:${c.item_id}`;
            inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 1));
          }
        }
      }
    } catch (e) {
      // Continue without player data
    }
  }

  const plans = buildCraftPlan(gd, targets, inventory);

  return new Response(
    JSON.stringify({
      player: playerInfo,
      inventory_size: inventory.size,
      plans,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
