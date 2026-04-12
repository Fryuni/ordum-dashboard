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
/// <reference lib="webworker" />

import {
  buildCraftPlan,
  type CraftPlan,
  type CraftTarget,
} from "../../common/craft-planner";
import type { PlayerCapabilities } from "../../common/player-capabilities";

export interface CraftPlannerRequest {
  id: number;
  targets: CraftTarget[];
  inventory: Map<string, number>;
  capabilities?: PlayerCapabilities;
}

export type CraftPlannerResponse =
  | { id: number; result: CraftPlan }
  | { id: number; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<CraftPlannerRequest>) => {
  const { id, targets, inventory, capabilities } = event.data;
  try {
    const result = buildCraftPlan(targets, inventory, capabilities);
    ctx.postMessage({ id, result } satisfies CraftPlannerResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ id, error: message } satisfies CraftPlannerResponse);
  }
});
