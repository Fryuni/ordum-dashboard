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
import { LazyKeyed } from "../lazy";

export type ItemType = "Item" | "Cargo";

export interface ItemReference {
  item_type: ItemType;
  item_id: number;
  // __item_key?: string;
}

export interface ItemEntry extends ItemReference {
  name: string;
  description?: string;
  tag?: string;
  tier: number;
  rarity: string;
  extracted_from: number[];
  crafted_from: number[];
  crafted_into: number[];
}

export interface ItemStack extends ItemReference {
  quantity: number;
}

export interface CraftRecipe {
  id: number;
  name: string;
  effort: number;
  passive: boolean;
  unpacking?: boolean;
  buildingType: string;
  requiredBuildingTier: number;
  requiredSkills: Array<{
    skill: string;
    level: number;
  }>;
  requiredTool: Array<{
    tool: string;
    level: number;
  }>;
  effectiveRequiredSkills: Array<{ skill: string; level: number }>;
  effectiveRequiredTool: Array<{ tool: string; level: number }>;
  inputs: ItemStack[];
  outputs: ItemStack[];
}

export interface ExtractionRecipe {
  id: number;
  verb: string;
  name: string;
  requiredSkills: Array<{
    skill: string;
    level: number;
  }>;
  requiredTool: Array<{
    tool: string;
    level: number;
  }>;
  outputs: ItemStack[];
}

export interface ToolEntry {
  id: string;
  item: ItemEntry;
  level: number;
  power: number;
}

export interface ToolItemEntry {
  item_id: number;
  name: string;
  toolType: string;
  tier: number;
}

export function unifiedKey(itemType: string, itemId: number): string {
  const typeName = { item: "Item", cargo: "Cargo" }[
    itemType.toLowerCase().trim()
  ];
  if (!typeName)
    throw new Error(`Unknown item type: ${JSON.stringify(itemType)}`);
  return `${typeName}:${itemId}`;
}

const keyCache = new WeakMap<ItemReference, string>();

export function referenceKey(reference: ItemReference): string {
  const key = keyCache.get(reference);
  if (key) return key;
  const newKey = `${reference.item_type}:${reference.item_id}`;
  keyCache.set(reference, newKey);
  return newKey;
}

export const parseReferenceKey = LazyKeyed.wrap(
  (key: string): ItemReference => {
    const [itemType, idString] = key.split(":", 2);
    if (!itemType || !idString) throw new Error(`Invalid item key: ${key}`);
    return {
      item_type: itemType as any,
      item_id: Number.parseInt(idString, 10),
    };
  },
);
