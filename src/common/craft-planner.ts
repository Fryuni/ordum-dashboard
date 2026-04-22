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
  unpackingRecipes,
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
  Rare: 40,
  Epic: 100,
  Legendary: 150,
  Mythic: 300,
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

const MAX_DEPTH = 2000;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CraftTarget extends ItemReference {
  quantity: number;
}

export interface StepInput {
  item: ItemEntry;
  quantity_per_craft: number;
  /**
   * Total units the player can cover for this step without further gathering,
   * drawn from starting inventory plus upstream step outputs (and, for raw
   * inputs, the raw-material gather budget). Equals `available_from_inventory`
   * plus the amount produced in-plan.
   */
  available: number;
  /**
   * Portion of `available` that comes from the player's starting inventory
   * at the time this step's predecessors have already drawn their share.
   * The rest of `available` is produced in-plan: by an upstream step for
   * intermediates, or by gathering for `is_raw` inputs.
   */
  available_from_inventory: number;
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
  passive: boolean;
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
  sub: PlanNode[];
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
function resupplyCostPerUnit(item: ItemEntry, baseline: BaselineCache): number {
  const rank = RARITY_RANK[item.rarity] ?? 0;
  if (rank < RARE_RANK_THRESHOLD) return 0;
  return Math.max(0, baseline.effortPerUnit(referenceKey(item)) - 1);
}

function extractionRate(recipe: ExtractionRecipe, targetKey: string): number {
  return (
    recipe.outputs.find((o) => referenceKey(o) === targetKey)?.quantity ?? 0
  );
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

    // Extraction baseline uses the harmonic mean of adjusted per-unit
    // efforts rather than `min(effort_i)`. A gatherer with no spatial
    // information can't commit to a single resource node, so pretending
    // they always land at the cheapest one overstates efficiency; the
    // harmonic mean weights the mix by rate and bakes the rarity floor
    // and capability penalty already folded into `extractionEffortPerUnit`.
    // Infinite entries are skipped so they don't dominate the estimate.
    let invSum = 0;
    let count = 0;
    for (const eid of item.extracted_from) {
      const recipe = extractionsCodex.get(eid);
      if (!recipe) continue;
      const effort = extractionEffortPerUnit(item, recipe, this.capabilities);
      if (!isFinite(effort) || effort <= 0) continue;
      invSum += 1 / effort;
      count += 1;
    }
    let best = count > 0 ? count / invSum : Infinity;

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

// ─── Recycler index: one-hop byproduct → target conversions ─────────────────

/**
 * A "recycler" is a craft recipe that converts a byproduct of an extraction
 * into the target the extraction primarily produces (e.g. split a Rough
 * Wood Trunk into 4 Rough Tree Bark when Chop Dead Tree co-produces both).
 * We cache the *best* recycler per (target, byproduct) pair so joint-aware
 * scoring and the post-build rebalance pass can look them up in O(1).
 *
 * Guards against cycles that would defeat the cost discipline:
 *
 * 1. One-hop only — the recycler must directly consume `byproductKey` and
 *    directly output `targetKey`.
 * 2. A recipe that also outputs `byproductKey` is rejected (trivial loop).
 * 3. A recipe that also consumes `targetKey` is rejected (double-count).
 * 4. Recycler data never feeds back into `BaselineCache.effortPerUnit` —
 *    the baseline stays a pure scalar estimator. This is what keeps the
 *    mutual recursion risk contained.
 */
interface RecyclerEntry {
  recipe: CraftRecipe;
  byproductKey: string;
  byproductInputPerCraft: number;
  targetOutputPerCraft: number;
  /** Effort added by one craft, amortized per target produced. */
  effortPerTarget: number;
  /** Target units produced per 1 byproduct unit consumed. */
  targetPerByproductUnit: number;
  /** Effort added per 1 byproduct unit recycled (captures other-input + recipe effort). */
  effortPerByproductUnit: number;
}

class RecyclerIndex {
  private cache = new Map<string, RecyclerEntry | null>();
  constructor(
    private baseline: BaselineCache,
    private capabilities: PlayerCapabilities | undefined,
  ) {}

  /** Return the best recycler recipe that turns `byproductKey` into `targetKey`, or null. */
  bestFor(targetKey: string, byproductKey: string): RecyclerEntry | null {
    const cacheKey = `${targetKey}<-${byproductKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const byproduct = itemsCodex.get(byproductKey);
    if (!byproduct) {
      this.cache.set(cacheKey, null);
      return null;
    }

    let best: RecyclerEntry | null = null;
    for (const rid of byproduct.crafted_into) {
      const recipe = recipesCodex.get(rid);
      if (!recipe) continue;
      const entry = this.evaluate(recipe, targetKey, byproductKey);
      if (!entry) continue;
      if (!best || entry.effortPerTarget < best.effortPerTarget) {
        best = entry;
      }
    }

    this.cache.set(cacheKey, best);
    return best;
  }

  private evaluate(
    recipe: CraftRecipe,
    targetKey: string,
    byproductKey: string,
  ): RecyclerEntry | null {
    // `effectiveOutputPerCraft` falls back to `1` when the target isn't in
    // the recipe's outputs at all, so we need an explicit presence check
    // before computing the effective count (which does account for rarity
    // promotion when the target IS produced).
    const outputsTarget = recipe.outputs.some(
      (o) => referenceKey(o) === targetKey,
    );
    if (!outputsTarget) return null;
    const targetOutputPerCraft = effectiveOutputPerCraft(recipe, targetKey);
    if (targetOutputPerCraft <= 0) return null;

    let byproductInputPerCraft = 0;
    for (const input of recipe.inputs) {
      const k = referenceKey(input);
      if (k === byproductKey) byproductInputPerCraft += input.quantity;
      if (k === targetKey) return null;
    }
    if (byproductInputPerCraft <= 0) return null;

    for (const out of recipe.outputs) {
      if (referenceKey(out) === byproductKey) return null;
    }

    let extraEffort = recipe.effort;
    for (const input of recipe.inputs) {
      const k = referenceKey(input);
      if (k === byproductKey) continue;
      const perUnit = this.baseline.effortPerUnit(k);
      if (!isFinite(perUnit)) return null;
      extraEffort += input.quantity * perUnit;
    }
    if (
      !canMeetSkillRequirements(this.capabilities, recipe.requiredSkills) ||
      !canMeetToolRequirements(this.capabilities, recipe.requiredTool)
    ) {
      extraEffort *= CAPABILITY_PENALTY;
    }

    return {
      recipe,
      byproductKey,
      byproductInputPerCraft,
      targetOutputPerCraft,
      effortPerTarget: extraEffort / targetOutputPerCraft,
      targetPerByproductUnit: targetOutputPerCraft / byproductInputPerCraft,
      effortPerByproductUnit: extraEffort / byproductInputPerCraft,
    };
  }
}

/**
 * Per-unit effort of producing `targetKey` via `recipe`, accounting for
 * byproducts that can be one-hop converted back into `targetKey`. A strike
 * that also spits out a recyclable byproduct is worth more than a strike
 * with no side-production — this is what lets the planner prefer
 * "Chop Dead Tree" over "Chop Rotten Log" when the target is bark.
 *
 * The formula accumulates effort and target counts across direct gathering
 * and recycled byproducts, then divides. A `min(direct, joint)` clamp
 * prevents an expensive recycler from *worsening* the extraction's score.
 * A small tiebreaker rewards extractions that expose more recyclable
 * byproducts, since those surplus products feed the post-build rebalance
 * pass and avoid wasted co-production.
 */
function jointAwareExtractionPerUnit(
  targetKey: string,
  recipe: ExtractionRecipe,
  baseline: BaselineCache,
  capabilities: PlayerCapabilities | undefined,
  recyclers: RecyclerIndex,
): number {
  const directRate = extractionRate(recipe, targetKey);
  if (directRate <= 0) return Infinity;

  const item = itemsCodex.get(targetKey);
  if (!item) return Infinity;
  const rf = rarityFactor(item);
  const strikesPerUnit = Math.max(1 / directRate, rf);
  const penalty =
    canMeetSkillRequirements(capabilities, recipe.requiredSkills) &&
    canMeetToolRequirements(capabilities, recipe.requiredTool)
      ? 1
      : CAPABILITY_PENALTY;

  const effortPerStrike = rf * penalty;
  const directTargetPerStrike = 1 / strikesPerUnit;
  const directPerUnit = effortPerStrike / directTargetPerStrike;

  let extraTargetPerStrike = 0;
  let extraEffortPerStrike = 0;
  let recyclerCount = 0;
  for (const out of recipe.outputs) {
    const outKey = referenceKey(out);
    if (outKey === targetKey) continue;
    const best = recyclers.bestFor(targetKey, outKey);
    if (!best) continue;
    recyclerCount += 1;
    extraTargetPerStrike += out.quantity * best.targetPerByproductUnit;
    extraEffortPerStrike += out.quantity * best.effortPerByproductUnit;
  }

  if (recyclerCount === 0) return directPerUnit;

  const totalTargetPerStrike = directTargetPerStrike + extraTargetPerStrike;
  const totalEffortPerStrike = effortPerStrike + extraEffortPerStrike;
  if (totalTargetPerStrike <= 0) return directPerUnit;

  const jointPerUnit = totalEffortPerStrike / totalTargetPerStrike;
  // An expensive recycler must not *penalize* a co-producing extraction vs a
  // direct-only one — the player can always opt to waste the byproduct.
  const clamped = Math.min(directPerUnit, jointPerUnit);
  // Stable tiebreaker: prefer extractions that surface more recyclable
  // byproducts. The nudge is tiny (`1e-9` × count) so it never reorders
  // economically distinct candidates — it only separates otherwise-tied
  // direct-equivalent scores (e.g. Chop Dead Tree vs Chop Rotten Log for
  // bark, where both yield 0.945 bark/strike but only Dead Tree co-produces
  // recyclable trunks for the rebalance pass to harvest).
  return clamped - 1e-9 * recyclerCount;
}

// ─── Tree building ────────────────────────────────────────────────────────────

interface TreeContext {
  baseline: BaselineCache;
  recyclers: RecyclerIndex;
  capabilities: PlayerCapabilities | undefined;
  depth: number;
  /**
   * Items currently being resolved on the recursion stack. Without this, a
   * legitimate gameplay cycle like seeds↔plants (where each recipe takes the
   * other as input) recurses forever until `MAX_DEPTH` fires, dumping the
   * in-progress item and all its downstream consumers as raw materials.
   */
  visiting: Set<string>;
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

  let haveNode: PlanNode | null =
    have > 0
      ? ({
          kind: "have",
          item,
          quantity: have,
          effort: resupplyCostPerUnit(item, ctx.baseline) * have,
        } satisfies HaveNode)
      : null;

  let missing = amount - have;

  const unpacking = unpackingRecipes.get(itemKey);
  if (unpacking) {
    const unpackRecipe = recipesCodex.get(unpacking.recipeId)!;
    const packedItem = unpackRecipe.inputs[0]!; // Unpacking recipes have a single input
    const packedOnHand = inventory.get(referenceKey(packedItem)) ?? 0;
    const needed = Math.ceil(missing / unpacking.outputAmount);
    const havePacked = Math.min(packedOnHand, needed);

    if (havePacked > 0) {
      const equivalent = havePacked * unpacking.outputAmount;
      inventory.set(referenceKey(packedItem), packedOnHand - havePacked);

      const unpackNode: CraftTreeNode = {
        kind: "craft",
        item,
        recipe: unpackRecipe,
        craftCount: havePacked,
        quantity: equivalent,
        inputs: [
          {
            kind: "have",
            item: itemsCodex.get(referenceKey(packedItem))!,
            effort: 0,
            quantity: havePacked,
          } satisfies HaveNode,
        ],
        effort: 0,
        missing_skill: false,
        missing_tool: false,
      };

      haveNode = composeNode(item, haveNode, unpackNode);
      missing -= equivalent;
      inventory.set(itemKey, Math.max(0, -missing));
    }
  }

  if (haveNode && missing <= 0) {
    return haveNode;
  }

  if (ctx.depth > MAX_DEPTH) {
    const node: AcquireTreeNode = {
      kind: "acquire",
      item,
      quantity: missing,
      effort: missing * PURCHASE_EFFORT_PER_UNIT,
    };
    return composeNode(item, haveNode, node);
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

  type Candidate = {
    kind: "extract" | "craft";
    id: number;
    effort: number;
    missingSkill: boolean;
    missingTool: boolean;
  };

  let bestCandidate: Candidate | null = null;

  function better(a: Candidate | null, b: Candidate): Candidate {
    if (a === null) return b;
    const canA = !a.missingSkill && !a.missingTool;
    const canB = !b.missingSkill && !b.missingTool;

    if (canA && !canB) return a;
    if (canB && !canA) return b;

    if (b.effort < a.effort) return b;
    return a;
  }

  for (const eid of item.extracted_from) {
    const recipe = extractionsCodex.get(eid);
    if (!recipe) continue;
    const perUnit = jointAwareExtractionPerUnit(
      itemKey,
      recipe,
      ctx.baseline,
      ctx.capabilities,
      ctx.recyclers,
    );
    const missingSkill = !canMeetSkillRequirements(
      ctx.capabilities,
      recipe.requiredSkills,
    );
    const missingTool = !canMeetToolRequirements(
      ctx.capabilities,
      recipe.requiredTool,
    );
    if (!isFinite(perUnit)) continue;
    const total = perUnit * missing;
    bestCandidate = better(bestCandidate, {
      kind: "extract",
      id: eid,
      effort: total,
      missingSkill,
      missingTool,
    });
  }

  // Skip craft candidates when the item is already on the recursion stack —
  // a gameplay cycle like seeds↔plants would otherwise pick itself as the
  // winner on every re-entry and recurse until `MAX_DEPTH`. Extractions are
  // still considered, and if none apply we fall through to `acquire`.
  const inCycle = ctx.visiting.has(itemKey);

  for (const rid of inCycle ? [] : item.crafted_from) {
    const recipe = recipesCodex.get(rid);
    if (!recipe || recipe.unpacking) continue;
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

    const missingSkill = !canMeetSkillRequirements(
      ctx.capabilities,
      recipe.effectiveRequiredSkills,
    );
    const missingTool = !canMeetToolRequirements(
      ctx.capabilities,
      recipe.effectiveRequiredTool,
    );

    const total = perUnit * missing;
    bestCandidate = better(bestCandidate, {
      kind: "craft",
      id: rid,
      effort: total,
      missingSkill,
      missingTool,
    });
  }

  if (!bestCandidate) {
    const node: AcquireTreeNode = {
      kind: "acquire",
      item,
      quantity: missing,
      effort: missing * PURCHASE_EFFORT_PER_UNIT,
    };
    return composeNode(item, haveNode, node);
  }

  // ── Phase 2: build the tree for the winning candidate only ──

  let resultNode: PlanNode;

  if (bestCandidate.kind === "extract") {
    const recipe = extractionsCodex.get(bestCandidate.id)!;
    const rate = extractionRate(recipe, itemKey);
    const rf = rarityFactor(item);
    const { missingSkill, missingTool } = bestCandidate;
    const strikes = Math.max(missing / rate, missing * rf);
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
    const recipe = recipesCodex.get(bestCandidate.id)!;
    const outputPerCraft = effectiveOutputPerCraft(recipe, itemKey);
    const craftCount = Math.max(1, Math.ceil(missing / outputPerCraft));

    const inputs: PlanNode[] = [];
    ctx.visiting.add(itemKey);
    try {
      for (const input of recipe.inputs) {
        const inputNeeded = input.quantity * craftCount;
        const subNode = buildTree(referenceKey(input), inputNeeded, inventory, {
          ...ctx,
          depth: ctx.depth + 1,
        });
        inputs.push(subNode);
      }
    } finally {
      ctx.visiting.delete(itemKey);
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

  return have > 0 ? composeNode(item, haveNode, resultNode) : resultNode;
}

function composeNode(
  item: ItemEntry,
  ...sub: Array<PlanNode | null>
): CompositeNode {
  const subs = sub
    .filter((s) => s !== null)
    .flatMap((s) => (s.kind === "composite" ? s.sub : [s]));
  return {
    kind: "composite",
    item,
    sub: subs,
    effort: subs.reduce((acc, s) => acc + s.effort, 0),
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildCraftPlan(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  capabilities?: PlayerCapabilities,
): CraftPlan {
  const baseline = new BaselineCache(capabilities);
  const recyclers = new RecyclerIndex(baseline, capabilities);
  const workingInv = new Map(inventory);
  const visiting = new Set<string>();
  const trees: PlanNode[] = [];
  for (const target of targets.sort((a, b) => a.item_id - b.item_id)) {
    if (!Number.isFinite(target.quantity) || target.quantity <= 0) continue;
    const tree = buildTree(referenceKey(target), target.quantity, workingInv, {
      baseline,
      recyclers,
      capabilities,
      depth: 0,
      visiting,
    });
    trees.push(tree);
  }
  return linearize(trees, inventory, capabilities, recyclers);
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
  recyclers: RecyclerIndex,
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

  /**
   * Every extract node that resolves a given target. The rebalance pass
   * uses this to find byproducts it can convert back into the target via
   * a recycler craft recipe. We keep all usages (not just the first) so
   * different extractions contributing to the same item both get inspected.
   */
  interface ExtractUsage {
    recipe: ExtractionRecipe;
    strikes: number;
    byproducts: Map<string, number>;
    missingSkill: boolean;
    missingTool: boolean;
  }
  const extractUsages = new Map<string, ExtractUsage[]>();

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

        const byproducts = new Map<string, number>();
        for (const out of node.recipe.outputs) {
          const outKey = referenceKey(out);
          if (outKey === key) continue;
          byproducts.set(
            outKey,
            (byproducts.get(outKey) ?? 0) + out.quantity * node.strikes,
          );
        }
        const list = extractUsages.get(key);
        const usage: ExtractUsage = {
          recipe: node.recipe,
          strikes: node.strikes,
          byproducts,
          missingSkill: node.missing_skill,
          missingTool: node.missing_tool,
        };
        if (list) list.push(usage);
        else extractUsages.set(key, [usage]);
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
        for (const sub of node.sub) {
          walk(sub);
        }
        return;
    }
  }

  for (const tree of trees) walk(tree);

  // ── Rebalance pass (Change 3): recycle extraction byproducts ──
  //
  // When an extraction co-produces an item that a craft recipe can turn
  // back into the extraction's primary target (bark/trunk is the canonical
  // case), inject synthesized craft steps so those byproducts don't get
  // silently wasted. Pool for each target:
  //
  // - byproducts tracked in `extractUsages` for that target
  // - anything the player already has in `originalInventory`
  //   (minus what `buildTree` already committed)
  //
  // We compose a pool across all (recycler recipe × available byproduct)
  // combinations, sort by effort-per-target ascending, and greedily fill
  // shortfall with whole crafts. Whole-craft granularity keeps step counts
  // clean and matches how `plan.steps` is presented.

  const targetsForRebalance = new Set<string>();
  for (const tree of trees)
    targetsForRebalance.add(referenceKey(rootDemand(tree).item));

  const rebalanceByproductConsumed = new Map<string, number>();

  for (const targetKey of targetsForRebalance) {
    const usages = extractUsages.get(targetKey);
    if (!usages || usages.length === 0) continue;

    type Segment = {
      recycler: RecyclerEntry;
      availableBypQty: number;
      available: number;
      missingSkill: boolean;
      missingTool: boolean;
    };
    const byproductPools = new Map<
      string,
      { total: number; missingSkill: boolean; missingTool: boolean }
    >();
    for (const usage of usages) {
      for (const [bypKey, qty] of usage.byproducts) {
        const existing = byproductPools.get(bypKey);
        if (existing) {
          existing.total += qty;
          existing.missingSkill ||= usage.missingSkill;
          existing.missingTool ||= usage.missingTool;
        } else {
          byproductPools.set(bypKey, {
            total: qty,
            missingSkill: usage.missingSkill,
            missingTool: usage.missingTool,
          });
        }
      }
    }

    const segments: Segment[] = [];
    for (const [bypKey, pool] of byproductPools) {
      const recycler = recyclers.bestFor(targetKey, bypKey);
      if (!recycler) continue;
      const inventoryBypRaw = originalInventory.get(bypKey) ?? 0;
      const inventoryByp = Math.max(
        0,
        inventoryBypRaw - (rebalanceByproductConsumed.get(bypKey) ?? 0),
      );
      const availableBypQty = pool.total + inventoryByp;
      if (availableBypQty < recycler.byproductInputPerCraft) continue;
      segments.push({
        recycler,
        availableBypQty,
        available: availableBypQty,
        missingSkill: pool.missingSkill,
        missingTool: pool.missingTool,
      });
    }
    if (segments.length === 0) continue;

    segments.sort(
      (a, b) => a.recycler.effortPerTarget - b.recycler.effortPerTarget,
    );

    let producedSoFar = 0;
    for (const s of steps.values()) {
      for (const out of s.recipe.outputs) {
        if (referenceKey(out) !== targetKey) continue;
        producedSoFar += out.quantity * s.craftCount;
      }
    }
    const targetQty = (() => {
      let q = 0;
      for (const tree of trees) {
        const rd = rootDemand(tree);
        if (referenceKey(rd.item) === targetKey) q += rd.quantity;
      }
      return q;
    })();
    let shortfall = targetQty - producedSoFar;
    if (shortfall <= 0) continue;

    for (const seg of segments) {
      if (shortfall <= 0) break;
      const { recycler } = seg;
      const maxCraftsByAvail = Math.floor(
        seg.available / recycler.byproductInputPerCraft,
      );
      const maxCraftsByDemand = Math.max(
        1,
        Math.ceil(shortfall / recycler.targetOutputPerCraft),
      );
      const crafts = Math.min(maxCraftsByAvail, maxCraftsByDemand);
      if (crafts <= 0) continue;

      const existing = steps.get(recycler.recipe.id);
      if (existing) {
        existing.craftCount += crafts;
        existing.missingSkill ||= seg.missingSkill;
        existing.missingTool ||= seg.missingTool;
      } else {
        steps.set(recycler.recipe.id, {
          recipe: recycler.recipe,
          craftCount: crafts,
          missingSkill: seg.missingSkill,
          missingTool: seg.missingTool,
        });
      }
      const consumed = crafts * recycler.byproductInputPerCraft;
      rebalanceByproductConsumed.set(
        recycler.byproductKey,
        (rebalanceByproductConsumed.get(recycler.byproductKey) ?? 0) + consumed,
      );
      seg.available -= consumed;
      shortfall -= crafts * recycler.targetOutputPerCraft;
    }
  }

  // Extraction byproducts offset step demand only for byproducts the
  // rebalance actually consumed. Generic "X is a side-effect of Y's
  // extraction so X is free" accounting is out of scope here — it would
  // mask intentional gathering for items that happen to be side-products
  // of the plan's extractions (e.g. tree sap extraction yields bark as a
  // side output, but in an Astralite plan we still want bark tracked as a
  // raw because the tree sap strikes weren't scaled with bark demand in
  // mind).
  const extractionByproductSupply = new Map<string, number>();
  for (const usages of extractUsages.values()) {
    for (const usage of usages) {
      for (const [bypKey, qty] of usage.byproducts) {
        if (!rebalanceByproductConsumed.has(bypKey)) continue;
        extractionByproductSupply.set(
          bypKey,
          (extractionByproductSupply.get(bypKey) ?? 0) + qty,
        );
      }
    }
  }

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

  for (const [bypKey, supplied] of extractionByproductSupply) {
    stepProduction.set(
      bypKey,
      (stepProduction.get(bypKey) ?? 0) + Math.ceil(supplied),
    );
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
    const demand = (stepDemand.get(key) ?? 0) + (targetDemand.get(key) ?? 0);
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

    const source =
      chosen?.recipe?.verb ?? (chosen?.recipe ? "Obtain" : "Obtain");

    rawMaterials.push({
      item_id: item.item_id,
      item_type: item.item_type,
      name: item.name,
      tier: item.tier,
      tag: item.tag || "",
      total_needed: netNeeded,
      likely_effort: likelyEffort,
      available: Math.min(inv, netNeeded),
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

  // Phase 3: build CraftStep entries by replaying consumption in topological
  // order. `consumption` is the full pool (inventory + pre-gathered raws +
  // step outputs) and feeds the `available` figure. `inventoryRemaining`
  // only ever starts with the player's stock and is never topped up — it
  // attributes the inventory-sourced portion of each input separately from
  // amounts produced in-plan. `steps` iterates leaves-first because `walk`
  // recurses into children before inserting the parent.
  const consumption = new Map<string, number>(originalInventory);
  const inventoryRemaining = new Map<string, number>(originalInventory);
  for (const raw of rawMaterials) {
    const k = `${raw.item_type}:${raw.item_id}`;
    const current = consumption.get(k) ?? 0;
    const deficit = Math.max(0, raw.total_needed - current);
    consumption.set(k, current + deficit);
  }
  for (const [bypKey, supplied] of extractionByproductSupply) {
    consumption.set(
      bypKey,
      (consumption.get(bypKey) ?? 0) + Math.ceil(supplied),
    );
  }

  const rawSteps: CraftStep[] = [];
  for (const s of steps.values()) {
    const inputs: StepInput[] = s.recipe.inputs.map((stack) => {
      const key = referenceKey(stack);
      const needed = Math.ceil(stack.quantity * s.craftCount);
      const current = consumption.get(key) ?? 0;
      const used = Math.max(0, Math.min(current, needed));
      consumption.set(key, current - needed);
      const invCurrent = inventoryRemaining.get(key) ?? 0;
      const fromInventory = Math.max(0, Math.min(invCurrent, needed));
      inventoryRemaining.set(key, invCurrent - fromInventory);
      return {
        item: itemsCodex.get(key) ?? fallbackItem(stack),
        quantity_per_craft: Math.floor(stack.quantity),
        available: used,
        available_from_inventory: fromInventory,
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
      passive: s.recipe.passive,
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
        quantity: node.sub.reduce(
          (acc, sub) => acc + rootDemand(sub).quantity,
          0,
        ),
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
