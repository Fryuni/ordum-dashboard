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
import {
  $inventorySources,
  $availableSources,
  toggleSource,
} from "../../stores/craftSource";
import PlayerPicker from "./PlayerPicker";

export default function InventorySourcePicker() {
  const selected = useStore($inventorySources);
  const sources = useStore($availableSources);
  const selectedSet = new Set(selected);

  const playerSources = sources.filter((s) => s.group === "player");
  const claimSources = sources.filter((s) => s.group === "claim");

  return (
    <div class="inventory-source-picker">
      <div class="form-row">
        <PlayerPicker />
      </div>
      <div class="inventory-sources-panel">
        <label class="inventory-sources-label">Inventory Sources</label>
        <div class="inventory-sources-grid">
          {playerSources.length > 0 && (
            <div class="source-group">
              <div class="source-group-label">Player</div>
              {playerSources.map((s) => (
                <label key={s.key} class="source-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.key)}
                    onChange={() => toggleSource(s.key)}
                  />
                  <span>
                    {s.icon} {s.label}
                  </span>
                </label>
              ))}
            </div>
          )}
          {claimSources.length > 0 && (
            <div class="source-group">
              <div class="source-group-label">Claims</div>
              {claimSources.map((s) => (
                <label key={s.key} class="source-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(s.key)}
                    onChange={() => toggleSource(s.key)}
                  />
                  <span>
                    {s.icon} {s.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
