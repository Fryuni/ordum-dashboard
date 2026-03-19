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
