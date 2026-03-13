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
  $groupItemIndex,
  $groupTargets,
  groupClearAll,
  type IndexItem,
} from "../../lib/group-craft-store";
import GroupItemPicker from "./GroupItemPicker";
import GroupItemList from "./GroupItemList";

interface Props {
  itemIndex: IndexItem[];
}

export default function GroupCraftConfiguration({ itemIndex }: Props) {
  const targets = useStore($groupTargets);

  useEffect(() => {
    $groupItemIndex.set(itemIndex);
  }, [itemIndex]);

  return (
    <div class="planner-card">
      <div class="claim-context">
        <span class="claim-icon">🏰</span>
        <span>
          Using <strong>Ordum Claim</strong> building storage
        </span>
      </div>

      <GroupItemPicker />
      <GroupItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-secondary"
            onClick={groupClearAll}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
