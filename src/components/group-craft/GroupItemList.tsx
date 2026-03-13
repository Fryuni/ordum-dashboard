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
  $groupTargets,
  groupRemoveTarget,
  groupEditTarget,
} from "../../lib/group-craft-store";

export default function GroupItemList() {
  const targets = useStore($groupTargets);

  if (targets.length === 0) return null;

  return (
    <div class="target-items">
      {targets.map((t, i) => (
        <div class="target-chip" key={`${t.type}-${t.id}`}>
          <span class="name">{t.name}</span>
          <span class="qty">×{t.quantity}</span>
          <button
            type="button"
            class="edit"
            onClick={() => groupEditTarget(i)}
            title="Edit"
          >
            ✏️
          </button>
          <button
            type="button"
            class="remove"
            onClick={() => groupRemoveTarget(i)}
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
