/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
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
