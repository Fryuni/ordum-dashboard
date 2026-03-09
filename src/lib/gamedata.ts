/**
 * BitCraft Game Data Parser
 *
 * Loads and indexes the static game data files downloaded from
 * BitCraftToolBox/BitCraft_GameData for use by settlement planner
 * and craft planner pages.
 */

import fs from "node:fs";
import path from "node:path";

// ─── Raw JSON Types ────────────────────────────────────────────────────────────

export interface GameItemDesc {
  id: number;
  name: string;
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

export interface GameItemStack {
  item_id: number;
  quantity: number;
  item_type: "Item" | "Cargo";
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
  functions: { function_type: number; level: number; storage_slots: number; cargo_slots: number }[];
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

// ─── Indexed Game Data ─────────────────────────────────────────────────────────

export interface GameData {
  items: Map<number, GameItemDesc>;
  cargo: Map<number, GameCargoDesc>;
  recipes: GameCraftingRecipe[];
  recipesByOutput: Map<string, GameCraftingRecipe[]>; // "Item:id" or "Cargo:id"
  extractionRecipes: GameExtractionRecipe[];
  extractionByOutput: Map<string, GameExtractionRecipe[]>;
  claimTechs: GameClaimTech[];
  claimTechById: Map<number, GameClaimTech>;
  buildings: Map<number, GameBuildingDesc>;
  buildingTypes: Map<number, GameBuildingTypeDesc>;
  skills: Map<number, GameSkillDesc>;
  tools: Map<number, GameToolDesc>;
  toolTypes: Map<number, GameToolTypeDesc>;
  resources: Map<number, GameResourceDesc>;
  itemLists: Map<number, GameItemListDesc>;
  constructionRecipes: GameConstructionRecipe[];
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function loadGameData(gamedataDir?: string): GameData {
  const dir = gamedataDir ?? path.join(process.cwd(), "gamedata");

  const rawItems = loadJson<GameItemDesc[]>(path.join(dir, "item_desc.json"));
  const rawCargo = loadJson<GameCargoDesc[]>(path.join(dir, "cargo_desc.json"));
  const rawRecipes = loadJson<GameCraftingRecipe[]>(path.join(dir, "crafting_recipe_desc.json"));
  const rawExtraction = loadJson<GameExtractionRecipe[]>(path.join(dir, "extraction_recipe_desc.json"));
  const rawClaimTechs = loadJson<GameClaimTech[]>(path.join(dir, "claim_tech_desc.json"));
  const rawBuildings = loadJson<GameBuildingDesc[]>(path.join(dir, "building_desc.json"));
  const rawBuildingTypes = loadJson<GameBuildingTypeDesc[]>(path.join(dir, "building_type_desc.json"));
  const rawSkills = loadJson<GameSkillDesc[]>(path.join(dir, "skill_desc.json"));
  const rawTools = loadJson<GameToolDesc[]>(path.join(dir, "tool_desc.json"));
  const rawToolTypes = loadJson<GameToolTypeDesc[]>(path.join(dir, "tool_type_desc.json"));
  const rawResources = loadJson<GameResourceDesc[]>(path.join(dir, "resource_desc.json"));
  const rawItemLists = loadJson<GameItemListDesc[]>(path.join(dir, "item_list_desc.json"));
  const rawConstruction = loadJson<GameConstructionRecipe[]>(path.join(dir, "construction_recipe_desc.json"));

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

  // Index extraction recipes by output
  const extractionByOutput = new Map<string, GameExtractionRecipe[]>();
  for (const r of rawExtraction) {
    for (const out of r.extracted_item_stacks) {
      const key = `${out.item_stack.item_type}:${out.item_stack.item_id}`;
      if (!extractionByOutput.has(key)) extractionByOutput.set(key, []);
      extractionByOutput.get(key)!.push(r);
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

  return {
    items,
    cargo,
    recipes: rawRecipes,
    recipesByOutput,
    extractionRecipes: rawExtraction,
    extractionByOutput,
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

// ─── Utility Functions ─────────────────────────────────────────────────────────

/** Get name for an item/cargo by type and ID */
export function getItemName(gd: GameData, itemType: "Item" | "Cargo", itemId: number): string {
  if (itemType === "Item") {
    return gd.items.get(itemId)?.name ?? `Unknown Item #${itemId}`;
  }
  return gd.cargo.get(itemId)?.name ?? `Unknown Cargo #${itemId}`;
}

/** Get item/cargo description */
export function getItemInfo(
  gd: GameData,
  itemType: "Item" | "Cargo",
  itemId: number,
): { name: string; tier: number; tag: string; icon: string; rarity: string } {
  if (itemType === "Item") {
    const item = gd.items.get(itemId);
    if (item) return { name: item.name, tier: item.tier, tag: item.tag, icon: item.icon_asset_name, rarity: item.rarity };
  } else {
    const c = gd.cargo.get(itemId);
    if (c) return { name: c.name, tier: c.tier, tag: c.tag, icon: c.icon_asset_name, rarity: c.rarity };
  }
  return { name: `Unknown #${itemId}`, tier: 0, tag: "", icon: "", rarity: "Common" };
}

export function getSkillName(gd: GameData, skillId: number): string {
  return gd.skills.get(skillId)?.name ?? `Skill #${skillId}`;
}

export function getToolTypeName(gd: GameData, toolTypeId: number): string {
  return gd.toolTypes.get(toolTypeId)?.name ?? `Tool Type #${toolTypeId}`;
}

export function getBuildingTypeName(gd: GameData, buildingTypeId: number): string {
  return gd.buildingTypes.get(buildingTypeId)?.name ?? `Building Type #${buildingTypeId}`;
}
