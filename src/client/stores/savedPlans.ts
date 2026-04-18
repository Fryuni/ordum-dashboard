/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { atom } from "nanostores";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { $targets } from "./craft";
import { $virtualInventory, clearVirtualInventory } from "./craftSource";
import type { ItemPlace } from "../../common/claim-inventory";
import { itemsCodex } from "../../common/gamedata/codex";
import { referenceKey } from "../../common/gamedata/definition";

export type SavedPlan = FunctionReturnType<
  typeof api.craftPlans.listMine
>[number];
export type PresetPlan = FunctionReturnType<
  typeof api.craftPlans.listPresets
>[number];
export type SavedPlanVirtualEntry = SavedPlan["virtualInventory"][number];

/** Search query for the saved plans sidebar. Listened via `useStore` in the component. */
export const $planSearchQuery = atom<string>("");

function serializeVirtualInventory(
  map: Map<string, ItemPlace[]>,
): SavedPlanVirtualEntry[] {
  const entries: SavedPlanVirtualEntry[] = [];
  for (const [key, places] of map) {
    entries.push({
      key,
      places: places.map((p) => ({ name: p.name, quantity: p.quantity })),
    });
  }
  return entries;
}

function deserializeVirtualInventory(
  entries: SavedPlanVirtualEntry[],
): Map<string, ItemPlace[]> {
  const map = new Map<string, ItemPlace[]>();
  for (const entry of entries) {
    map.set(
      entry.key,
      entry.places.map((p) => ({ name: p.name, quantity: p.quantity })),
    );
  }
  return map;
}

/** Read the current craft state for passing to `api.craftPlans.savePlan`. */
export function getCurrentPlanPayload(): {
  targets: ReturnType<typeof $targets.get>;
  virtualInventory: SavedPlanVirtualEntry[];
} {
  return {
    targets: $targets.get(),
    virtualInventory: serializeVirtualInventory($virtualInventory.get()),
  };
}

/** Load a saved or preset plan into the live craft state. */
export function loadPlanAction(plan: SavedPlan | PresetPlan): void {
  $targets.set(
    plan.targets.map((target) => ({
      ...target,
      name: itemsCodex.get(referenceKey(target))?.name!,
    })),
  );
  if ("virtualInventory" in plan && plan.virtualInventory) {
    $virtualInventory.set(deserializeVirtualInventory(plan.virtualInventory));
  } else {
    clearVirtualInventory();
  }
}
