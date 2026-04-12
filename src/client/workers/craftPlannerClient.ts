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
import CraftPlannerWorker from "./craftPlanner.worker?worker";
import type { CraftPlan, CraftTarget } from "../../common/craft-planner";
import type { PlayerCapabilities } from "../../common/player-capabilities";
import type { CraftPlannerResponse } from "./craftPlanner.worker";

type Pending = {
  resolve: (plan: CraftPlan) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker {
  if (worker) return worker;
  const w = new CraftPlannerWorker();
  w.addEventListener("message", (event: MessageEvent<CraftPlannerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if ("error" in response) {
      entry.reject(new Error(response.error));
    } else {
      entry.resolve(response.result);
    }
  });
  w.addEventListener("error", (event: ErrorEvent) => {
    const err = new Error(event.message || "Craft planner worker error");
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  });
  worker = w;
  return w;
}

export function buildCraftPlanAsync(
  targets: CraftTarget[],
  inventory: Map<string, number>,
  capabilities?: PlayerCapabilities,
): Promise<CraftPlan> {
  const w = ensureWorker();
  const id = nextRequestId++;
  return new Promise<CraftPlan>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, targets, inventory, capabilities });
  });
}
