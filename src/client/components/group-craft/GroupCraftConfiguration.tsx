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
import { useStore } from "@nanostores/preact";
import { $targets, clearAll } from "../../stores/craft";
import ItemPicker from "../craft/ItemPicker";
import ItemList from "../craft/ItemList";

export default function GroupCraftConfiguration() {
  const targets = useStore($targets);

  return (
    <div class="planner-card">
      <div class="claim-context">
        <span class="claim-icon">🏰</span>
        <span>
          Using <strong>Ordum Claim</strong> building storage
        </span>
      </div>

      <ItemPicker />
      <ItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onClick={clearAll}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
