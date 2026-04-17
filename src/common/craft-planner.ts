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
 */
/**
 * Craft Planner
 *
 * Given a list of target items and a player's current inventory, builds a
 * crafting tree that satisfies every target. For each item, the planner
 * weighs every available recipe and extraction against the *full* cost of
 * acquiring its inputs — not just the recipe's own effort — so that an
 * intermediate made of legendary-rarity ingredients is correctly recognized
 * as more expensive than a common alternative, even if the recipe itself
 * looks cheaper.
 *
 * The tree is preserved on the returned plan (`plan.trees`) for future
 * rendering; `plan.steps` is its linearization, leaves-first, with
 * repeated recipes merged into a single step.
 */

import { topologicalSort } from "./topological-sort";
import {
  extractionsCodex,
  itemsCodex,
  recipesCodex,
} from "./gamedata/codex";
import {
  referenceKey,
  type CraftRecipe,
  type ExtractionRecipe,
  type ItemEntry,
  type ItemReference,
  type ItemType,
} from "./gamedata/definition";
import {
  canMeetSkillRequirements,
  canMeetToolRequirements,
  type PlayerCapabilities,
} from "./player-capabilities";

// ─── Effort constants ─────────────────────────────────────────────────────────

/**
 * Difficulty of obtaining a single item of a given rarity, relative to Common.
 * Used to penalize plans that rely on rare/epic/legendary intermediates.
 */
const RARITY_FACTOR: Record<string, number> = {
  Common: 1,
  Uncommon: 5,
  Rare: 15,
  Epic: 30,
  Legendary: 50,
  Mythic: 100,
};

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

/** Multiplier applied when the player can't meet a recipe's skill/tool gate. */
const CAPABILITY_PENALTY = 100;

/** Effort cost for an item with no recipe/extraction (e.g. NPC purchase). */
const PURCHASE_EFFORT_PER_UNIT = 1000;

const MAX_DEPTH = 500;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CraftTarget extends ItemReference {
  quantity: number;
}

export interface StepInput {
  item: ItemEntry;
  quantity_per_craft: number;
  available: number;
  is_raw: boolean;
}

export interface StepOutput {
  item: ItemEntry;
  quantity_per_craft: number;
}

export interface CraftStep {
  craft_count: number;
  effort_per_craft: number;
  recipe_id: number;
  recipe_name: string;
  building_type: string;
  building_tier: number;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  inputs: StepInput[];
  outputs: StepOutput[];
  depth: number;
  missing_skill: boolean;
  missing_tool: boolean;
}

export interface RawMaterial {
  item_id: number;
  item_type: ItemType;
  name: string;
  tier: number;
  tag: string;
  total_needed: number;
  likely_effort: number;
  available: number;
  source: string;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  resource_sources: string[];
  missing_skill: boolean;
  missing_tool: boolean;
}

export interface FulfilledItem extends ItemReference {
  name: string;
  quantity: number;
}

// ─── Tree node types ──────────────────────────────────────────────────────────

/**
 * Quantity drawn from existing inventory. For Rare+ items the effort is
 * nonzero — it represents the resupply cost the player would eventually
 * pay to replace what they're consuming, discounted by 1 so that
 * inventory items are always preferred over fresh acquisition.
 */
export interface HaveNode {
  kind: "have";
  item: ItemEntry;
  quantity: number;
  effort: number;
}

/** Gather `quantity` of `item` via a single extraction recipe. */
export interface ExtractTreeNode {
  kind: "extract";
  item: ItemEntry;
  recipe: ExtractionRecipe;
  strikes: number;
  quantity: number;
  effort: number;
  missing_skill: boolean;
  missing_tool: boolean;
}

/**
 * Craft `quantity` of `item` via a recipe; inputs are resolved recursively.
 *
 * `craftCount` is the integer number of crafts a player actually performs.
 * Any surplus output is deposited into a running inventory so that sibling
 * demands can draw from it.
 */
export interface CraftTreeNode {
  kind: "craft";
  item: ItemEntry;
  recipe: CraftRecipe;
  craftCount: number;
  quantity: number;
  inputs: PlanNode[];
  effort: number;
  missing_skill: boolean;
  missing_tool: boolean;
}

/** Item with no recipe or extraction (typically bought from NPCs). */
export interface AcquireTreeNode {
  kind: "acquire";
  item: ItemEntry;
  quantity: number;
  effort: number;
}

/** Part of `amount` comes from inventory, the rest comes from `sub`. */
export interface CompositeNode {
  kind: "composite";
  item: ItemEntry;
  fromInventory: number;
  sub: PlanNode;
  effort: number;
}

export type PlanNode =
  | HaveNode
  | ExtractTreeNode
  | CraftTreeNode
  | AcquireTreeNode
  | CompositeNode;

export interface CraftPlan {
  steps: CraftStep[];
  raw_materials: RawMaterial[];
  already_have: FulfilledItem[];
  /** One tree per target, in the order the targets were supplied. */
  trees: PlanNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rarityFactor(item: ItemEntry): number {
  return RARITY_FACTOR[item.rarity] ?? 1;
}

/**
 * How many outputs of `targetKey` one craft of `recipe` yields, aggregating
 * same-name outputs whose rarity is at or above the target's (a legendary
 * byproduct satisfies a common target).
 */
function effectiveOutputPerCraft(
  recipe: CraftRecipe,
  targetKey: string,
): number {
  const targetItem = itemsCodex.get(targetKey);
  if (!targetItem) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }
  const targetRank = RARITY_RANK[targetItem.rarity] ?? -1;
  let total = 0;
  let found = false;
  for (const out of recipe.outputs) {
    const outKey = referenceKey(out);
    const outItem = itemsCodex.get(outKey);
    if (!outItem) continue;
    if (
      outItem.name === targetItem.name &&
      (RARITY_RANK[outItem.rarity] ?? -1) >= targetRank
    ) {
      total += out.quantity;
      if (outKey === targetKey) found = true;
    }
  }
  if (!found || total <= 0) {
    return (
      recipe.outputs.find((s) => referenceKey(s) === targetKey)?.quantity || 1
    );
  }
  return total;
}

const RARE_RANK_THRESHOLD = RARITY_RANK["Rare"]!; // Rare and above

/**
 * Cost of consuming an item from inventory. For Common/Uncommon items the
 * cost is 0 (easily replaced). For Rare+ items the cost is one less than
 * the baseline acquisition cost — always cheaper than gathering fresh,
 * but still discouraging casual consumption of hard-to-get ingredients.
 */
function resupplyCostPerUnit(
  item: ItemEntry,
  baseline: BaselineCache,
): number {
  const rank = RARITY_RANK[item.rarity] ?? 0;
  if (rank < RARE_RANK_THRESHOLD) return 0;
  return Math.max(0, baseline.effortPerUnit(referenceKey(item)) - 1);
}

function extractionRate(
  recipe: ExtractionRecipe,
  targetKey: string,
): number {
  return recipe.outputs.find((o) => referenceKey(o) === targetKey)?.quantity ?? 0;
}

function extractionEffortPerUnit(
  item: ItemEntry,
  recipe: ExtractionRecipe,
  capabilities: PlayerCapabilities | undefined,
): number {
  const rate = extractionRate(recipe, referenceKey(item));
  if (rate <= 0) return Infinity;
  const rf = rarityFactor(item);
  // Each unit costs at least `rarityFactor` strikes (even when the recipe
  // claims >1 per strike — an unrealistic rate for a rare item usually
  // signals a dungeon / special workflow rather than real gathering).
  const strikesPerUnit = Math.max(1 / rate, rf);
  let effort = strikesPerUnit * rf;
  if (
    !canMeetSkillRequirements(capabilities, recipe.requiredSkills) ||
    !canMeetToolRequirements(capabilities, recipe.requiredTool)
  ) {
    effort *= CAPABILITY_PENALTY;
  }
  return effort;
}

// ─── Baseline effort: per-unit cost assuming empty inventory ──────────────────

/**
 * Memoizes the minimum effort to acquire one unit of an item ignoring
 * inventory. Used by the tree builder to rank candidate recipes: the
 * recipe that minimizes per-unit cost (amortized over its batch size)
 * wins, so a recipe that outputs 10 per craft is correctly seen as
 * cheaper per unit than one that outputs 1 even though the craft itself
 * has the same effort.
 */
class BaselineCache {
  private cache = new Map<string, number>();
  private inflight = new Set<string>();
  constructor(private capabilities: PlayerCapabilities | undefined) {}

  effortPerUnit(itemKey: string): number {
    const cached = this.cache.get(itemKey);
    if (cached !== undefined) return cached;
    if (this.inflight.has(itemKey)) return Infinity; // recipe cycle
    this.inflight.add(itemKey);

    const item = itemsCodex.get(itemKey);
    if (!item) {
      this.inflight.delete(itemKey);
      this.cache.set(itemKey, 0);
      return 0;
    }

    let best = Infinity;

    for (const eid of item.extracted_from) {
      const recipe = extractionsCodex.get(eid);
      if (!recipe) continue;
      const effort = extractionEffortPerUnit(item, recipe, this.capabilities);
      if (effort < best) best = effort;
    }

    for (const rid of item.crafted_from) {
      const recipe = recipesCodex.get(rid);
      if (!recipe) continue;
      const effort = this.recipePerUnit(recipe, itemKey);
      if (effort < best) best = effort;
    }

    if (!isFinite(best)) best = PURCHASE_EFFORT_PER_UNIT;

    this.inflight.delete(itemKey);
    this.cache.set(itemKey, best);
    return best;
  }

  /** Per-unit amortized cost of producing `targetKey` via this recipe. */
  recipePerUnit(recipe: CraftRecipe, targetKey: string): number {
    const outputPerCraft = effectiveOutputPerCraft(recipe, targetKey);
    if (outputPerCraft <= 0) return Infinity;
    let effort = recipe.effort / outputPerCraft;
    for (const input of recipe.inputs) {
      effort +=
        (input.quantity / outputPerCraft) *
        this.effortPerUnit(referenceKey(input));
    }
    if (
      !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
      !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
    ) {
      effort *= CAPABILITY_PENALTY;
    }
    return effort;
  }
}

// ─── Tree building ────────────────────────────────────────────────────────────

interface TreeContext {
  baseline: BaselineCache;
  capabilities: PlayerCapabilities | undefined;
  depth: number;
}

/**
 * Build a tree that satisfies `amount` of `itemKey`, consuming from and
 * writing surplus back into `inventory`. Mutates `inventory` with the
 * chosen branch's net effect.
 *
 * Recipe selection is O(candidates) per item via BaselineCache lookups;
 * full sub-tree construction is only done for the winning candidate. This
 * keeps the overall complexity linear in the plan size.
 */
function buildTree(
  itemKey: string,
  amount: number,
  inventory: Map<string, number>,
  ctx: TreeContext,
): PlanNode {
  const item = itemsCodex.get(itemKey);
  if (!item || amount <= 0) {
    return {
      kind: "acquire",
      item: item ?? ({} as ItemEntry),
      quantity: Math.max(0, amount),
      effort: Math.max(0, amount) * PURCHASE_EFFORT_PER_UNIT,
    };
  }

  const onHand = inventory.get(itemKey) ?? 0;
  const have = Math.min(amount, Math.max(0, onHand));
  if (have > 0) inventory.set(itemKey, onHand - have);

  if (have >= amount) {
    const resupply = resupplyCostPerUnit(item, ctx.baseline) * amount;
    return { kind: "have", item, quantity: amount, effort: resupply };
  }

  const missing = amount - have;

  if (ctx.depth > MAX_DEPTH) {
    const node: AcquireTreeNode = {
      kind: "acquire",
      item,
      quantity: missing,
      effort: missing * PURCHASE_EFFORT_PER_UNIT,
    };
    return have > 0 ? wrapPartial(item, have, node) : node;
  }

  // ── Phase 1: pick the cheapest acquisition path via BaselineCache ──
  //
  // Comparing recipes via their memoized amortized per-unit cost is O(1)
  // per candidate. We select the winner here and only recurse into *its*
  // sub-tree in Phase 2, avoiding the exponential blowup that would
  // result from building full sub-trees for every candidate.
  //
  // Inventory discount: if a recipe's direct input is already on hand,
  // that shaves off its gathering cost, potentially flipping the winner.

  type Candidate =
    | { kind: "extract"; eid: number; effort: number }
    | { kind: "craft"; rid: number; effort: number };

  let bestCandidate: Candidate | null = null;

  for (const eid of item.extracted_from) {
    const recipe = extractionsCodex.get(eid);
    if (!recipe) continue;
    const effort = extractionEffortPerUnit(item, recipe, ctx.capabilities);
    if (!isFinite(effort)) continue;
    const total = effort * missing;
    if (!bestCandidate || total < bestCandidate.effort) {
      bestCandidate = { kind: "extract", eid, effort: total };
    }
  }

  for (const rid of item.crafted_from) {
    const recipe = recipesCodex.get(rid);
    if (!recipe) continue;
    let perUnit = ctx.baseline.recipePerUnit(recipe, itemKey);
    if (!isFinite(perUnit)) continue;

    // First-level inventory discount: if any direct input is on hand,
    // replace its acquisition cost with the (cheaper) resupply cost.
    const outputPerCraft = effectiveOutputPerCraft(recipe, itemKey);
    if (outputPerCraft > 0) {
      for (const input of recipe.inputs) {
        const inputKey = referenceKey(input);
        const onHandInput = inventory.get(inputKey) ?? 0;
        if (onHandInput > 0) {
          const inputItem = itemsCodex.get(inputKey);
          if (!inputItem) continue;
          const needed = input.quantity / outputPerCraft;
          const covered = Math.min(onHandInput, needed * missing);
          const fullCost = ctx.baseline.effortPerUnit(inputKey);
          const invCost = resupplyCostPerUnit(inputItem, ctx.baseline);
          perUnit -= (covered / missing) * (fullCost - invCost);
        }
      }
    }

    const total = perUnit * missing;
    if (!bestCandidate || total < bestCandidate.effort) {
      bestCandidate = { kind: "craft", rid, effort: total };
    }
  }

  if (!bestCandidate) {
    const node: AcquireTreeNode = {
      kind: "acquire",
      item,
      quantity: missing,
      effort: missing * PURCHASE_EFFORT_PER_UNIT,
    };
    return have > 0 ? wrapPartial(item, have, node) : node;
  }

  // ── Phase 2: build the tree for the winning candidate only ──

  let resultNode: PlanNode;

  if (bestCandidate.kind === "extract") {
    const recipe = extractionsCodex.get(bestCandidate.eid)!;
    const rate = extractionRate(recipe, itemKey);
    const rf = rarityFactor(item);
    const strikes = Math.max(missing / rate, missing * rf);
    const missingSkill = !canMeetSkillRequirements(
      ctx.capabilities,
      recipe.requiredSkills,
    );
    const missingTool = !canMeetToolRequirements(
      ctx.capabilities,
      recipe.requiredTool,
    );
    let effort = strikes * rf;
    if (missingSkill || missingTool) effort *= CAPABILITY_PENALTY;

    for (const out of recipe.outputs) {
      const outKey = referenceKey(out);
      if (outKey === itemKey) continue;
      const produced = out.quantity * strikes;
      if (produced > 0) {
        inventory.set(outKey, (inventory.get(outKey) ?? 0) + produced);
      }
    }

    resultNode = {
      kind: "extract",
      item,
      recipe,
      strikes,
      quantity: missing,
      effort,
      missing_skill: missingSkill,
      missing_tool: missingTool,
    };
  } else {
    const recipe = recipesCodex.get(bestCandidate.rid)!;
    const outputPerCraft = effectiveOutputPerCraft(recipe, itemKey);
    const craftCount = Math.max(1, Math.ceil(missing / outputPerCraft));

    const inputs: PlanNode[] = [];
    for (const input of recipe.inputs) {
      const inputNeeded = input.quantity * craftCount;
      const subNode = buildTree(referenceKey(input), inputNeeded, inventory, {
        ...ctx,
        depth: ctx.depth + 1,
      });
      inputs.push(subNode);
    }

    for (const out of recipe.outputs) {
      const outKey = referenceKey(out);
      const produced = out.quantity * craftCount;
      const toBank = outKey === itemKey ? produced - missing : produced;
      if (toBank > 0) {
        inventory.set(outKey, (inventory.get(outKey) ?? 0) + toBank);
      }
    }

    const missingSkill = !canMeetSkillRequirements(
      ctx.capabilities,
      recipe.requiredSkills,
    );
    const missingTool = !canMeetToolRequirements(
      ctx.capabilities,
      recipe.requiredTool,
    );

    resultNode = {
      kind: "craft",
      item,
      recipe,
      craftCount,
      quantity: missing,
      inputs,
      effort: bestCandidate.effort,
      missing_skill: missingSkill,
      missing_tool: missingTool,
    };
  }

  return have > 0 ? wrapPartial(item, have, resultNode) : resultNode;
}

function wrapPartial(
  item: ItemEntry,
  fromInventory: number,
  sub: PlanNode,
): CompositeNode {
  return { kind: "composite", item, fromInventory, sub, effort: sub.effort };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildCraftPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  capabilities?: PlayerCapabilities,
): CraftPlan {
  const baseline = new BaselineCache(capabilities);
  const workingInv = new Map(inventory);
  const trees: PlanNode[] = [];
  for (const target of targets) {
    if (!Number.isFinite(target.quantity) || target.quantity <= 0) continue;
    const tree = buildTree(
      referenceKey(target),
      target.quantity,
      workingInv,
      { baseline, capabilities, depth: 0 },
    );
    trees.push(tree);
  }
  return linearize(trees, inventory, capabilities);
}

// ─── Linearization (tree → steps + raws + already_have) ──────────────────────

interface AggregatedStep {
  recipe: CraftRecipe;
  craftCount: number; // integer; running sum across tree nodes sharing recipe
  missingSkill: boolean;
  missingTool: boolean;
}

function linearize(
  trees: PlanNode[],
  originalInventory: ReadonlyMap<string, number>,
  capabilities: PlayerCapabilities | undefined,
): CraftPlan {
  // Phase 1: aggregate CraftNodes by recipe id, and record the extraction
  // chosen for each raw item (so UI knows the verb/skills).
  const steps = new Map<number, AggregatedStep>();
  const chosenExtraction = new Map<
    string,
    {
      item: ItemEntry;
      recipe: ExtractionRecipe | null;
      strikesPerUnit: number;
      missingSkill: boolean;
      missingTool: boolean;
    }
  >();

  function walk(node: PlanNode): void {
    switch (node.kind) {
      case "have":
        return;
      case "extract": {
        const key = referenceKey(node.item);
        if (!chosenExtraction.has(key)) {
          const strikesPerUnit =
            node.quantity > 0 ? node.strikes / node.quantity : 0;
          chosenExtraction.set(key, {
            item: node.item,
            recipe: node.recipe,
            strikesPerUnit,
            missingSkill: node.missing_skill,
            missingTool: node.missing_tool,
          });
        }
        return;
      }
      case "acquire": {
        const key = referenceKey(node.item);
        if (!chosenExtraction.has(key)) {
          chosenExtraction.set(key, {
            item: node.item,
            recipe: null,
            strikesPerUnit: 0,
            missingSkill: false,
            missingTool: false,
          });
        }
        return;
      }
      case "craft": {
        for (const child of node.inputs) walk(child);
        const existing = steps.get(node.recipe.id);
        if (existing) {
          existing.craftCount += node.craftCount;
          existing.missingSkill ||= node.missing_skill;
          existing.missingTool ||= node.missing_tool;
        } else {
          steps.set(node.recipe.id, {
            recipe: node.recipe,
            craftCount: node.craftCount,
            missingSkill: node.missing_skill,
            missingTool: node.missing_tool,
          });
        }
        return;
      }
      case "composite":
        walk(node.sub);
        return;
    }
  }

  for (const tree of trees) walk(tree);

  // Phase 2: demand and production analysis.
  // Target-level demand: each tree's root item contributes its request; we
  // read this directly from the tree root's quantity fields.
  const targetDemand = new Map<string, number>();
  for (const tree of trees) {
    const { item, quantity } = rootDemand(tree);
    const k = referenceKey(item);
    targetDemand.set(k, (targetDemand.get(k) ?? 0) + quantity);
  }

  const stepDemand = new Map<string, number>();
  const stepProduction = new Map<string, number>();
  for (const s of steps.values()) {
    for (const input of s.recipe.inputs) {
      const k = referenceKey(input);
      stepDemand.set(
        k,
        (stepDemand.get(k) ?? 0) + Math.ceil(input.quantity * s.craftCount),
      );
    }
    for (const out of s.recipe.outputs) {
      const k = referenceKey(out);
      stepProduction.set(
        k,
        (stepProduction.get(k) ?? 0) + Math.ceil(out.quantity * s.craftCount),
      );
    }
  }

  // An item is a RAW if total demand exceeds what the plan produces PLUS
  // the player's inventory. Its `total_needed` is the total demand (the UI
  // uses this alongside `available` to tell the player how much of the
  // shortfall they need to gather).
  //
  // An item is ALREADY_HAVE if the player has enough in inventory to cover
  // the portion not produced by steps — i.e. inventory bridges the gap and
  // no gathering is needed.
  //
  // Remaining items are simply intermediates produced by steps.
  const allDemandKeys = new Set<string>([
    ...stepDemand.keys(),
    ...targetDemand.keys(),
  ]);

  const rawMaterials: RawMaterial[] = [];
  const alreadyHave: FulfilledItem[] = [];
  const rawKeys = new Set<string>();

  for (const key of allDemandKeys) {
    const demand =
      (stepDemand.get(key) ?? 0) + (targetDemand.get(key) ?? 0);
    if (demand <= 0) continue;
    const produced = stepProduction.get(key) ?? 0;
    const netNeeded = Math.max(0, demand - produced);
    if (netNeeded <= 0) continue;
    const inv = originalInventory.get(key) ?? 0;
    const item = itemsCodex.get(key);
    if (!item) continue;

    if (inv >= netNeeded) {
      // Inventory fully covers what steps don't produce.
      alreadyHave.push({
        item_type: item.item_type,
        item_id: item.item_id,
        name: item.name,
        quantity: inv,
      });
      continue;
    }

    // Gathering is required. `chosen` is populated for items the tree
    // resolved via extraction/acquire; when steps cover part of the demand
    // (e.g. some logs crafted, some gathered), the tree still recorded the
    // extraction that carried the deficit.
    const chosen = chosenExtraction.get(key);
    rawKeys.add(key);

    const bestStrikesPerUnit = strikesPerUnitOf(item);
    const likelyEffort = chosen?.recipe
      ? Math.ceil(Math.max(bestStrikesPerUnit, chosen.strikesPerUnit) * demand)
      : demand * PURCHASE_EFFORT_PER_UNIT;

    const source = chosen?.recipe?.verb ?? (chosen?.recipe ? "Obtain" : "Obtain");

    rawMaterials.push({
      item_id: item.item_id,
      item_type: item.item_type,
      name: item.name,
      tier: item.tier,
      tag: item.tag || "",
      total_needed: demand,
      likely_effort: likelyEffort,
      available: Math.min(inv, demand),
      source,
      skill_requirements: chosen?.recipe?.requiredSkills ?? [],
      tool_requirements: chosen?.recipe?.requiredTool ?? [],
      resource_sources: item.extracted_from
        .map((rid) => extractionsCodex.get(rid)?.name)
        .filter((n): n is string => n != null),
      missing_skill: chosen?.missingSkill ?? false,
      missing_tool: chosen?.missingTool ?? false,
    });
  }

  // Phase 3: build CraftStep entries with per-input "available from
  // inventory" by replaying consumption in topological order. Raw materials
  // are treated as pre-gathered up to their `total_needed`, matching how
  // the simulator in tests walks the plan.
  const consumption = new Map<string, number>(originalInventory);
  for (const raw of rawMaterials) {
    const k = `${raw.item_type}:${raw.item_id}`;
    const current = consumption.get(k) ?? 0;
    const deficit = Math.max(0, raw.total_needed - current);
    consumption.set(k, current + deficit);
  }

  const rawSteps: CraftStep[] = [];
  for (const s of steps.values()) {
    const inputs: StepInput[] = s.recipe.inputs.map((stack) => {
      const key = referenceKey(stack);
      const needed = Math.ceil(stack.quantity * s.craftCount);
      const current = consumption.get(key) ?? 0;
      const used = Math.max(0, Math.min(current, needed));
      consumption.set(key, current - needed);
      return {
        item: itemsCodex.get(key) ?? fallbackItem(stack),
        quantity_per_craft: Math.floor(stack.quantity),
        available: used,
        is_raw: rawKeys.has(key),
      };
    });
    for (const out of s.recipe.outputs) {
      const k = referenceKey(out);
      consumption.set(
        k,
        (consumption.get(k) ?? 0) + Math.ceil(out.quantity * s.craftCount),
      );
    }
    rawSteps.push({
      craft_count: s.craftCount,
      effort_per_craft: s.recipe.effort,
      recipe_id: s.recipe.id,
      recipe_name: s.recipe.name,
      building_type: s.recipe.buildingType,
      building_tier: s.recipe.requiredBuildingTier,
      skill_requirements: s.recipe.requiredSkills,
      tool_requirements: s.recipe.requiredTool,
      inputs,
      outputs: s.recipe.outputs.map(
        (stack): StepOutput => ({
          item: itemsCodex.get(referenceKey(stack))!,
          quantity_per_craft: stack.quantity,
        }),
      ),
      depth: 0,
      missing_skill: s.missingSkill,
      missing_tool: s.missingTool,
    });
  }

  const sortedSteps = topologicalSort(rawSteps, (a, b) => {
    for (const out of a.outputs) {
      for (const inp of b.inputs) {
        if (inp.item === out.item) return "a->b";
      }
    }
    for (const out of b.outputs) {
      for (const inp of a.inputs) {
        if (inp.item === out.item) return "b->a";
      }
    }
    return null;
  });
  sortedSteps.forEach((step, i, s) => {
    step.depth = s.length - i - 1;
  });

  return {
    steps: sortedSteps,
    raw_materials: rawMaterials,
    already_have: alreadyHave,
    trees,
  };
}

function rootDemand(node: PlanNode): { item: ItemEntry; quantity: number } {
  switch (node.kind) {
    case "have":
    case "extract":
    case "craft":
    case "acquire":
      return { item: node.item, quantity: node.quantity };
    case "composite":
      return {
        item: node.item,
        quantity: node.fromInventory + rootDemand(node.sub).quantity,
      };
  }
}

function strikesPerUnitOf(item: ItemEntry): number {
  let best = Infinity;
  for (const rid of item.extracted_from) {
    const recipe = extractionsCodex.get(rid);
    if (!recipe) continue;
    const rate = extractionRate(recipe, referenceKey(item));
    if (rate <= 0) continue;
    const rf = rarityFactor(item);
    const strikesPerUnit = Math.max(1 / rate, rf);
    if (strikesPerUnit < best) best = strikesPerUnit;
  }
  return isFinite(best) ? best : 1;
}

function fallbackItem(stack: {
  item_type: ItemType;
  item_id: number;
}): ItemEntry {
  return {
    item_type: stack.item_type,
    item_id: stack.item_id,
    name: "Unknown",
    rarity: "Common",
    tier: 0,
    crafted_from: [],
    crafted_into: [],
    extracted_from: [],
  };
}

