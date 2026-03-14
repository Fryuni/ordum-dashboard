import { persistentAtom } from "@nanostores/persistent";
import { atom, computedAsync, type AsyncValue } from "nanostores";
import { $updateTimer } from "../util-store";
import { api } from "../api";
import { buildClaimInventory } from "../claim-inventory";
import { ORDUM_MAIN_CLAIM_ID } from "../ordum-data";

// Player name for craft plan
export const $player = persistentAtom<string>("playerName", "");

export const $claim = persistentAtom<string>("claimName", "");

const $playerInfo = computedAsync([$player, $updateTimer], async (player) => {
  if (!player) return null;

  const page = await api.listPlayers({
    search: player,
    page: 1,
    per_page: 5,
  });
  return page.players.find((p) => p.username === player) ?? null;
});

const $playerInventory = computedAsync($playerInfo, async (player) => {
  const inventory = new Map<string, number>();
  if (player) {
    // Fetch player inventory if player name provided
    try {
      // Fetch ALL inventories owned by this player via the inventorys endpoint.
      // This returns personal inventory, tool belt, wallet, AND deployables
      // (carts, rafts, etc.) — everything the player owns.
      // Use the string key to avoid number precision loss.
      const invData = await api.findInventoryByOwnerEntityId(player.entity_id);
      for (const inv of invData.inventorys ?? []) {
        for (const pocket of inv.pockets ?? []) {
          const p = pocket as any;
          if (p?.contents) {
            const c = p.contents;
            const key = `${c.item_type ?? "Item"}:${c.item_id}`;
            inventory.set(key, (inventory.get(key) ?? 0) + (c.quantity ?? 1));
          }
        }
      }
    } catch {
      // Continue without player data
    }
  }
  return inventory;
});

const $claimInventory = computedAsync($updateTimer, () =>
  buildClaimInventory(ORDUM_MAIN_CLAIM_ID),
);

export const $inventory = import.meta.env.SSR
  ? atom<AsyncValue<Map<string, number>>>({
    state: "loading",
  })
  : window.location.pathname === "/craft"
    ? $playerInventory
    : $claimInventory;
