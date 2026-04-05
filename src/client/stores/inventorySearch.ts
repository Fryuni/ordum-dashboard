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
import { persistentAtom } from "@nanostores/persistent";
import { computedAsync } from "@nanostores/async";

import { useCapitalAsDefault } from "./craftSource";
import { convexAction } from "../convex";
import { api } from "../../../convex/_generated/api";

export interface InventorySearchItem {
  key: string;
  name: string;
  tier: number;
  tag: string;
  rarity: string;
  totalQuantity: number;
  locations: Array<{ name: string; quantity: number }>;
}

export interface InventorySearchResponse {
  items: InventorySearchItem[];
  claimName: string;
  regionName: string;
  claimLocationX: number;
  claimLocationZ: number;
}

export const $inventorySearchClaim = persistentAtom<string>(
  "inventorySearchClaim",
  "",
);
useCapitalAsDefault($inventorySearchClaim);

export const $inventorySearchData = computedAsync(
  [$inventorySearchClaim],
  async (claimId): Promise<InventorySearchResponse | null> => {
    if (!claimId) return null;
    return convexAction(api.inventorySearch.search, { claimId });
  },
);
