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
import { useConvexAuth } from "convex/react";
import CraftConfiguration from "../components/craft/CraftConfiguration";
import CraftingPlan from "../components/craft/CraftingPlan";
import SavedPlansPanel from "../components/craft/SavedPlansPanel";

export default function CraftPage() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <>
      <div class="header">
        <h1>⚒️ Craft Planner</h1>
        <p class="subtitle">
          Calculate full crafting trees from raw materials, using your player or
          claim inventory
        </p>
      </div>

      {isAuthenticated ? (
        <div class="craft-layout">
          <div class="craft-layout-main">
            <CraftConfiguration />
            <CraftingPlan />
          </div>
          <SavedPlansPanel />
        </div>
      ) : (
        <>
          <CraftConfiguration />
          <CraftingPlan />
        </>
      )}
    </>
  );
}
