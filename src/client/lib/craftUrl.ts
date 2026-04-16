import { getItemName } from "../../common/gamedata";
import type { ItemType } from "../../common/gamedata/definition";

interface CraftItem {
  itemType: string;
  itemId: number;
  quantity: number;
}

/**
 * Build a craft planner URL with the given items as targets and no inventory.
 * Uses gzip + base64url encoding matching the craft store's import logic.
 */
export async function buildCraftUrl(items: CraftItem[]): Promise<string> {
  const targets = items.map((item) => ({
    item_id: item.itemId,
    item_type: item.itemType,
    name: getItemName(item.itemType as ItemType, item.itemId),
    quantity: item.quantity,
  }));

  const compressedBuffer = await new Response(
    new Blob([JSON.stringify(targets)])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

  const encoded = new Uint8Array(compressedBuffer).toBase64({
    alphabet: "base64url",
    omitPadding: true,
  });

  return `/craft?targets=${encoded}&inv=none`;
}
