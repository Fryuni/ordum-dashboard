/**
 * Craft Planner
 *
 * Given a list of target items and a player's current inventory,
 * recursively resolves the full crafting tree down to raw (gathered)
 * materials, showing every step needed.
 */

import type { GameData, GameCraftingRecipe } from "./gamedata";
import { getItemName, getItemInfo, getSkillName, getToolTypeName, getBuildingTypeName } from "./gamedata";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CraftTarget {
  item_id: number;
  item_type: "Item" | "Cargo";
  quantity: number;
}

export interface CraftStep {
  output_item_id: number;
  output_item_type: "Item" | "Cargo";
  output_name: string;
  output_quantity_per_craft: number;
  craft_count: number;
  total_output: number;
  recipe_id: number;
  recipe_name: string;
  building_type: string;
  building_tier: number;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  inputs: {
    item_id: number;
    item_type: "Item" | "Cargo";
    name: string;
    quantity_per_craft: number;
    total_needed: number;
    available: number;
    deficit: number;
    is_raw: boolean;
  }[];
  depth: number;
}

export interface CraftPlan {
  target: CraftTarget;
  target_name: string;
  steps: CraftStep[];
  raw_materials: {
    item_id: number;
    item_type: "Item" | "Cargo";
    name: string;
    tier: number;
    tag: string;
    total_needed: number;
    available: number;
    deficit: number;
    source: string;
  }[];
  already_have: { item_id: number; item_type: "Item" | "Cargo"; name: string; quantity: number }[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_DEPTH = 15;

/** Recipe name patterns to skip (packaging/unpackaging creates cycles) */
function shouldSkipRecipe(recipe: GameCraftingRecipe): boolean {
  const name = recipe.name.toLowerCase();
  return name.startsWith("unpack ") || name.startsWith("package ");
}

// ─── Main Function ─────────────────────────────────────────────────────────────

export function buildCraftPlan(
  gd: GameData,
  targets: CraftTarget[],
  inventory: Map<string, number>,
): CraftPlan[] {
  return targets.map((target) => buildSinglePlan(gd, target, new Map(inventory)));
}

function buildSinglePlan(
  gd: GameData,
  target: CraftTarget,
  available: Map<string, number>,
): CraftPlan {
  const steps: CraftStep[] = [];
  const rawTotals = new Map<string, {
    item_id: number; item_type: "Item" | "Cargo";
    name: string; tier: number; tag: string;
    total_needed: number; source: string;
  }>();
  const alreadyHave: { item_id: number; item_type: "Item" | "Cargo"; name: string; quantity: number }[] = [];

  // Recursive resolve with global cycle detection
  const resolving = new Set<string>();

  function resolve(
    itemType: "Item" | "Cargo",
    itemId: number,
    quantity: number,
    depth: number,
  ): void {
    const key = `${itemType}:${itemId}`;

    // Check available inventory first
    const onHand = available.get(key) ?? 0;
    if (onHand >= quantity) {
      available.set(key, onHand - quantity);
      if (depth > 0) {
        alreadyHave.push({
          item_id: itemId,
          item_type: itemType,
          name: getItemName(gd, itemType, itemId),
          quantity,
        });
      }
      return;
    }

    const stillNeed = quantity - onHand;
    if (onHand > 0) available.set(key, 0);

    // Cycle detection
    if (resolving.has(key) || depth > MAX_DEPTH) {
      addRaw(key, itemType, itemId, stillNeed);
      return;
    }

    // Find crafting recipe (skip packaging/unpackaging)
    const recipes = (gd.recipesByOutput.get(key) ?? []).filter((r) => !shouldSkipRecipe(r));
    const recipe = pickBestRecipe(recipes);

    if (!recipe) {
      addRaw(key, itemType, itemId, stillNeed);
      return;
    }

    resolving.add(key);

    // Calculate craft count
    const outputStack = recipe.crafted_item_stacks.find(
      (s) => s.item_type === itemType && s.item_id === itemId,
    );
    const outputQty = outputStack?.quantity ?? 1;
    const craftCount = Math.ceil(stillNeed / outputQty);

    // Build inputs list
    const inputs = recipe.consumed_item_stacks.map((inp) => {
      const inpKey = `${inp.item_type}:${inp.item_id}`;
      const validRecipes = (gd.recipesByOutput.get(inpKey) ?? []).filter((r) => !shouldSkipRecipe(r));
      const isRaw = validRecipes.length === 0;
      return {
        item_id: inp.item_id,
        item_type: inp.item_type,
        name: getItemName(gd, inp.item_type, inp.item_id),
        quantity_per_craft: inp.quantity,
        total_needed: inp.quantity * craftCount,
        available: available.get(inpKey) ?? 0,
        deficit: 0, // filled after resolve
        is_raw: isRaw,
      };
    });

    // Record this step
    const buildingReq = recipe.building_requirement;
    steps.push({
      output_item_id: itemId,
      output_item_type: itemType,
      output_name: getItemName(gd, itemType, itemId),
      output_quantity_per_craft: outputQty,
      craft_count: craftCount,
      total_output: craftCount * outputQty,
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      building_type: buildingReq ? getBuildingTypeName(gd, buildingReq.building_type) : "Any",
      building_tier: buildingReq?.tier ?? 0,
      skill_requirements: recipe.level_requirements.map((r) => ({
        skill: getSkillName(gd, r.skill_id),
        level: r.level,
      })),
      tool_requirements: recipe.tool_requirements.map((r) => ({
        tool: getToolTypeName(gd, r.tool_type),
        level: r.level,
      })),
      inputs,
      depth,
    });

    // Recursively resolve inputs
    for (const inp of inputs) {
      resolve(inp.item_type, inp.item_id, inp.total_needed, depth + 1);
    }

    resolving.delete(key);
  }

  function addRaw(key: string, itemType: "Item" | "Cargo", itemId: number, quantity: number) {
    const existing = rawTotals.get(key);
    if (existing) {
      existing.total_needed += quantity;
    } else {
      const info = getItemInfo(gd, itemType, itemId);
      const source = getSourceVerb(gd, itemType, itemId);
      rawTotals.set(key, {
        item_id: itemId, item_type: itemType,
        name: info.name, tier: info.tier, tag: info.tag,
        total_needed: quantity, source,
      });
    }
  }

  resolve(target.item_type, target.item_id, target.quantity, 0);

  // Sort steps: deepest first (gather first, final product last)
  steps.sort((a, b) => b.depth - a.depth);

  // Update input deficits based on final state
  for (const step of steps) {
    for (const inp of step.inputs) {
      const inpKey = `${inp.item_type}:${inp.item_id}`;
      inp.available = available.get(inpKey) ?? 0;
      inp.deficit = Math.max(0, inp.total_needed - inp.available);
    }
  }

  return {
    target,
    target_name: getItemInfo(gd, target.item_type, target.item_id).name,
    steps,
    raw_materials: [...rawTotals.values()]
      .map((r) => ({
        ...r,
        available: 0,
        deficit: r.total_needed,
      }))
      .sort((a, b) => b.deficit - a.deficit),
    already_have: alreadyHave,
  };
}

function pickBestRecipe(recipes: GameCraftingRecipe[]): GameCraftingRecipe | null {
  if (recipes.length === 0) return null;
  if (recipes.length === 1) return recipes[0];

  return [...recipes].sort((a, b) => {
    // Prefer non-passive
    const aPassive = (a as any).is_passive ? 1 : 0;
    const bPassive = (b as any).is_passive ? 1 : 0;
    if (aPassive !== bPassive) return aPassive - bPassive;
    // Prefer lower building tier
    const aTier = a.building_requirement?.tier ?? 0;
    const bTier = b.building_requirement?.tier ?? 0;
    if (aTier !== bTier) return aTier - bTier;
    // Prefer fewer inputs
    return a.consumed_item_stacks.length - b.consumed_item_stacks.length;
  })[0];
}

function getSourceVerb(gd: GameData, itemType: "Item" | "Cargo", itemId: number): string {
  const key = `${itemType}:${itemId}`;
  const extraction = gd.extractionByOutput.get(key);
  if (extraction && extraction.length > 0) {
    return extraction[0].verb_phrase || "Gather";
  }
  return "Obtain";
}

// ─── Item Search Helper ────────────────────────────────────────────────────────

export interface ItemSearchResult {
  item_id: number;
  item_type: "Item" | "Cargo";
  name: string;
  tier: number;
  tag: string;
}

export function searchItems(gd: GameData, query: string, limit = 20): ItemSearchResult[] {
  const q = query.toLowerCase();
  const results: ItemSearchResult[] = [];

  for (const [id, item] of gd.items) {
    if (item.name.toLowerCase().includes(q)) {
      results.push({ item_id: id, item_type: "Item", name: item.name, tier: item.tier, tag: item.tag });
    }
    if (results.length >= limit * 2) break;
  }

  for (const [id, c] of gd.cargo) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({ item_id: id, item_type: "Cargo", name: c.name, tier: c.tier, tag: c.tag });
    }
    if (results.length >= limit * 2) break;
  }

  return results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === q ? 0 : 1;
    const bExact = b.name.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  }).slice(0, limit);
}
