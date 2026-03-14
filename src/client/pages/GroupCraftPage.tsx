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
import CraftingPlan from "../components/craft/CraftingPlan";
import GroupCraftConfiguration from "../components/group-craft/GroupCraftConfiguration";

export default function GroupCraftPage() {
  return (
    <>
      <div class="header">
        <h1>🏰 Empire Craft Planner</h1>
        <p class="subtitle">
          Calculate crafting trees using the Ordum claim's building storage
        </p>
      </div>

      <GroupCraftConfiguration />
      <CraftingPlan />
    </>
  );
}
