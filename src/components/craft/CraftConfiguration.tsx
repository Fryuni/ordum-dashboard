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
import { useEffect } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  $itemIndex,
  $targets,
  clearAll,
  type IndexItem,
} from "../../lib/craft-store";
import PlayerPicker from "./PlayerPicker";
import ItemPicker from "./ItemPicker";
import ItemList from "./ItemList";

interface Props {
  itemIndex: IndexItem[];
  members: { entity_id: number; user_name: string }[];
}

export default function CraftConfiguration({ itemIndex, members = [] }: Props) {
  const targets = useStore($targets);

  useEffect(() => {
    $itemIndex.set(itemIndex);
  }, [itemIndex]);

  return (
    <div class="planner-card">
      <div class="form-row">
        <PlayerPicker members={members} />
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
