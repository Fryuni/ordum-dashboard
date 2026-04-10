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
  $inventorySource,
  $empireClaims,
  $empireClaimsLoading,
} from "../../stores/craftSource";
import PlayerPicker from "./PlayerPicker";

export default function InventorySourcePicker() {
  const source = useStore($inventorySource);
  const claims = useStore($empireClaims);
  const loading = useStore($empireClaimsLoading);

  function handleSourceChange(e: Event) {
    $inventorySource.set((e.target as HTMLSelectElement).value);
  }

  return (
    <div class="inventory-source-picker">
      <div class="form-row">
        <PlayerPicker />
        <div class="input-group source-select-container">
          <label for="inventory-source">Inventory Source</label>
          <select
            id="inventory-source"
            class="source-select"
            value={source}
            onChange={handleSourceChange}
          >
            <option value="player">👤 Player Inventory</option>
            {loading && claims.length === 0 && (
              <option disabled>Loading claims…</option>
            )}
            {claims.map((claim) => (
              <option key={claim.id} value={claim.id}>
                🏰 {claim.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
