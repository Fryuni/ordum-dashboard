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
/**
 * BitCraft Game Data Parser
 *
 * Loads and indexes the static game data files downloaded from
 * BitCraftToolBox/BitCraft_GameData for use by settlement planner
 * and craft planner pages.
 */

import { Lazy, LazyKeyed } from "./lazy";

import _rawItems from "../../gamedata/item_desc.json";
import _rawCargo from "../../gamedata/cargo_desc.json";
import _rawRecipes from "../../gamedata/crafting_recipe_desc.json";
import _rawExtraction from "../../gamedata/extraction_recipe_desc.json";
import _rawClaimTechs from "../../gamedata/claim_tech_desc.json";
import _rawBuildings from "../../gamedata/building_desc.json";
import _rawBuildingTypes from "../../gamedata/building_type_desc.json";
import _rawSkills from "../../gamedata/skill_desc.json";
import _rawTools from "../../gamedata/tool_desc.json";
import _rawToolTypes from "../../gamedata/tool_type_desc.json";
import _rawResources from "../../gamedata/resource_desc.json";
import _rawItemLists from "../../gamedata/item_list_desc.json";
import _rawConstruction from "../../gamedata/construction_recipe_desc.json";

// ─── Raw JSON Types ────────────────────────────────────────────────────────────

export type ItemType = "Item" | "Cargo";

export interface ItemReference {
  item_type: ItemType;
  item_id: number;
  __item_key?: string;
}

export interface GameItemDesc {
  id: number;
  name: string;
  compendium_entry: boolean;
  description: string;
  volume: number;
  durability: number;
  icon_asset_name: string;
  tier: number;
  tag: string;
  rarity: string;
  item_list_id: number;
}

export interface GameCargoDesc {
  id: number;
  name: string;
  description: string;
  volume: number;
  icon_asset_name: string;
  tier: number;
  tag: string;
  rarity: string;
}

export interface GameItemStack extends ItemReference {
  quantity: number;
  durability?: number;
  discovery_score?: number;
  consumption_chance?: number;
}

export interface GameSkillReq {
  skill_id: number;
  level: number;
}

export interface GameToolReq {
  tool_type: number;
  level: number;
  power: number;
}

export interface GameBuildingReq {
  building_type: number;
  tier: number;
}

export interface GameCraftingRecipe {
  id: number;
  name: string;
  time_requirement: number;
  stamina_requirement: number;
  building_requirement: GameBuildingReq;
  level_requirements: GameSkillReq[];
  tool_requirements: GameToolReq[];
  consumed_item_stacks: GameItemStack[];
  crafted_item_stacks: GameItemStack[];
  actions_required: number;
  allow_use_hands: boolean;
  required_claim_tech_id: number;
  required_knowledges: number[];
}

export interface GameExtractionRecipe {
  id: number;
  resource_id: number;
  extracted_item_stacks: { item_stack: GameItemStack; probability: number }[];
  consumed_item_stacks: GameItemStack[];
  tool_requirements: GameToolReq[];
  allow_use_hands: boolean;
  level_requirements: GameSkillReq[];
  verb_phrase: string;
}

export interface GameClaimTech {
  id: number;
  name: string;
  description: string;
  tier: number;
  tech_type: string;
  supplies_cost: number;
  research_time: number;
  requirements: number[];
  input: GameItemStack[];
  members: number;
  area: number;
  supplies: number;
}

export interface GameBuildingDesc {
  id: number;
  name: string;
  description: string;
  functions: {
    function_type: number;
    level: number;
    storage_slots: number;
    cargo_slots: number;
  }[];
  wilderness: boolean;
}

export interface GameBuildingTypeDesc {
  id: number;
  name: string;
  category: string;
}

export interface GameSkillDesc {
  id: number;
  name: string;
}

export interface GameToolDesc {
  id: number;
  name: string;
  tool_type: number;
  tier: number;
}

export interface GameToolTypeDesc {
  id: number;
  name: string;
}

export interface GameResourceDesc {
  id: number;
  name: string;
  description: string;
}

export interface GameItemListDesc {
  id: number;
  name: string;
  possibilities: { probability: number; items: GameItemStack[] }[];
}

export interface GameConstructionRecipe {
  id: number;
  name: string;
  consumed_item_stacks: GameItemStack[];
  consumed_cargo_stacks: GameItemStack[];
  level_requirements: GameSkillReq[];
  tool_requirements: GameToolReq[];
}

// ─── Typed raw data (cast from JSON imports) ───────────────────────────────────

const rawItems = _rawItems as unknown as GameItemDesc[];
const rawCargo = _rawCargo as unknown as GameCargoDesc[];
const rawRecipes = _rawRecipes as unknown as GameCraftingRecipe[];
const rawExtraction = _rawExtraction as unknown as GameExtractionRecipe[];
const rawClaimTechs = _rawClaimTechs as unknown as GameClaimTech[];
const rawBuildings = _rawBuildings as unknown as GameBuildingDesc[];
const rawBuildingTypes = _rawBuildingTypes as unknown as GameBuildingTypeDesc[];
const rawSkills = _rawSkills as unknown as GameSkillDesc[];
const rawTools = _rawTools as unknown as GameToolDesc[];
const rawToolTypes = _rawToolTypes as unknown as GameToolTypeDesc[];
const rawResources = _rawResources as unknown as GameResourceDesc[];
const rawItemLists = _rawItemLists as unknown as GameItemListDesc[];
const rawConstruction = _rawConstruction as unknown as GameConstructionRecipe[];

// ─── Indexed Game Data ─────────────────────────────────────────────────────────

/** Maps an "Output" item to its resolved real items via item_list_id */
export interface ItemListResolution {
  outputItemId: number;
  realItemType: ItemType;
  realItemId: number;
  quantity: number; // quantity from the highest-probability possibility
}

function loadGameData() {
  // Index items
  const items = new Map<number, GameItemDesc>();
  for (const i of rawItems) items.set(i.id, i);

  const cargo = new Map<number, GameCargoDesc>();
  for (const c of rawCargo) cargo.set(c.id, c);

  // Index recipes by output
  const recipesByOutput = new Map<string, GameCraftingRecipe[]>();
  for (const r of rawRecipes) {
    for (const out of r.crafted_item_stacks) {
      const key = `${out.item_type}:${out.item_id}`;
      if (!recipesByOutput.has(key)) recipesByOutput.set(key, []);
      recipesByOutput.get(key)!.push(r);
    }
  }

  // Build item_list_id → output item id lookup, and resolve Output items to real items.
  // Many recipes produce "Output" items (e.g. "Rough Wood Log Output") whose item_list_id
  // points to an item list that resolves to the real item (e.g. "Rough Wood Log").
  // We index these so the craft planner can find recipes for real items that are only
  // produced indirectly through item lists.
  const recipesByResolvedOutput = new Map<
    string,
    { recipe: GameCraftingRecipe; outputPerCraft: number }[]
  >();

  // Map: item_list_id → GameItemListDesc
  const itemListById = new Map<number, GameItemListDesc>();
  for (const il of rawItemLists) itemListById.set(il.id, il);

  // For each recipe output that is an "Output" item (has item_list_id), resolve it
  for (const r of rawRecipes) {
    for (const out of r.crafted_item_stacks) {
      if (out.item_type !== "Item") continue;
      const outputItem = items.get(out.item_id);
      if (!outputItem || outputItem.item_list_id === 0) continue;

      const itemList = itemListById.get(outputItem.item_list_id);
      if (!itemList || itemList.possibilities.length === 0) continue;

      // Take the highest-probability possibility to determine the real output
      const bestPossibility = itemList.possibilities.reduce((best, p) =>
        p.probability > best.probability ? p : best,
      );
      if (!bestPossibility) continue;

      for (const realItem of bestPossibility.items) {
        const realKey = `${realItem.item_type}:${realItem.item_id}`;
        const outputPerCraft = realItem.quantity * out.quantity;
        if (!recipesByResolvedOutput.has(realKey))
          recipesByResolvedOutput.set(realKey, []);
        recipesByResolvedOutput
          .get(realKey)!
          .push({ recipe: r, outputPerCraft });
      }
    }
  }

  // Index other lookups
  const claimTechById = new Map<number, GameClaimTech>();
  for (const t of rawClaimTechs) claimTechById.set(t.id, t);

  const buildings = new Map<number, GameBuildingDesc>();
  for (const b of rawBuildings) buildings.set(b.id, b);

  const buildingTypes = new Map<number, GameBuildingTypeDesc>();
  for (const bt of rawBuildingTypes) buildingTypes.set(bt.id, bt);

  const skills = new Map<number, GameSkillDesc>();
  for (const s of rawSkills) skills.set(s.id, s);

  const toolsMap = new Map<number, GameToolDesc>();
  for (const t of rawTools) toolsMap.set(t.id, t);

  const toolTypes = new Map<number, GameToolTypeDesc>();
  for (const tt of rawToolTypes) toolTypes.set(tt.id, tt);

  const resources = new Map<number, GameResourceDesc>();
  for (const r of rawResources) resources.set(r.id, r);

  const itemLists = new Map<number, GameItemListDesc>();
  for (const il of rawItemLists) itemLists.set(il.id, il);

  const extractionByOutput = Lazy.wrap(() => {
    // Index extraction recipes by output
    const extractionByOutput = new Map<string, GameExtractionRecipe[]>();
    for (const r of rawExtraction) {
      for (const out of realItemStack(
        r.extracted_item_stacks.map((r) => r.item_stack),
      )) {
        const key = `${out.item_type}:${out.item_id}`;
        if (!extractionByOutput.has(key)) extractionByOutput.set(key, []);
        extractionByOutput.get(key)!.push(r);
      }
    }
    return extractionByOutput;
  });

  const recipesById = new Map<number, GameCraftingRecipe>();
  for (const recipe of rawRecipes) {
    recipesById.set(recipe.id, recipe);
  }

  return {
    items,
    cargo,
    recipes: rawRecipes,
    recipesById,
    recipesByOutput,
    recipesByResolvedOutput,
    extractionRecipes: rawExtraction,
    get extractionByOutput() {
      return extractionByOutput();
    },
    claimTechs: rawClaimTechs,
    claimTechById,
    buildings,
    buildingTypes,
    skills,
    tools: toolsMap,
    toolTypes,
    resources,
    itemLists,
    constructionRecipes: rawConstruction,
  };
}

export const gd = loadGameData();

// ─── Utility Functions ─────────────────────────────────────────────────────────

/** Get name for an item/cargo by type and ID */
export function getItemName(itemType: ItemType, itemId: number): string {
  if (itemType === "Item") {
    return gd.items.get(itemId)?.name ?? `Unknown Item #${itemId}`;
  }
  return gd.cargo.get(itemId)?.name ?? `Unknown Cargo #${itemId}`;
}

/** Get item/cargo description */
export function getItemInfo(
  itemType: ItemType,
  itemId: number,
): { name: string; tier: number; tag: string; icon: string; rarity: string } {
  if (itemType === "Item") {
    const item = gd.items.get(itemId);
    if (item)
      return {
        name: item.name,
        tier: item.tier,
        tag: item.tag,
        icon: item.icon_asset_name,
        rarity: item.rarity,
      };
  } else {
    const c = gd.cargo.get(itemId);
    if (c)
      return {
        name: c.name,
        tier: c.tier,
        tag: c.tag,
        icon: c.icon_asset_name,
        rarity: c.rarity,
      };
  }
  return {
    name: `Unknown #${itemId}`,
    tier: 0,
    tag: "",
    icon: "",
    rarity: "Common",
  };
}

export function unifiedKey(itemType: string, itemId: number): string {
  const typeName = { item: "Item", cargo: "Cargo" }[
    itemType.toLowerCase().trim()
  ];
  if (!typeName)
    throw new Error(`Unknown item type: ${JSON.stringify(itemType)}`);
  return `${typeName}:${itemId}`;
}

export function referenceKey(reference: ItemReference): string {
  if (!reference.__item_key) {
    reference.__item_key = `${reference.item_type}:${reference.item_id}`;
  }
  return reference.__item_key;
}

export const parseReferenceKey = LazyKeyed.wrap(
  (key: string): ItemReference => {
    const [itemType, idString] = key.split(":", 2);
    if (!itemType || !idString) throw new Error(`Invalid item key: ${key}`);
    return {
      item_type: itemType as any,
      item_id: Number.parseInt(idString, 10),
      __item_key: key,
    };
  },
);

export function getSkillName(skillId: number): string {
  return gd.skills.get(skillId)?.name ?? `Skill #${skillId}`;
}

export function getToolTypeName(toolTypeId: number): string {
  return gd.toolTypes.get(toolTypeId)?.name ?? `Tool Type #${toolTypeId}`;
}

export function getBuildingTypeName(buildingTypeId: number): string {
  return (
    gd.buildingTypes.get(buildingTypeId)?.name ??
    `Building Type #${buildingTypeId}`
  );
}

export function realItemStack(
  list: GameItemStack[],
  externalMultiplier = 1,
): GameItemStack[] {
  const { items, itemLists } = gd;

  if (externalMultiplier !== 1) {
    list = list.map((item) => ({
      ...item,
      quantity: item.quantity * externalMultiplier,
    }));
  }

  return list.flatMap((item) => {
    if (item.item_type !== "Item") return item;
    const outputItem = items.get(item.item_id);
    if (!outputItem || outputItem.item_list_id === 0) return item;

    const itemList = itemLists.get(outputItem.item_list_id);
    if (!itemList) return item;

    return itemList.possibilities.flatMap((list) =>
      realItemStack(list.items).map((i) => ({
        ...i,
        quantity: i.quantity * item.quantity * list.probability,
      })),
    );
  });
}
