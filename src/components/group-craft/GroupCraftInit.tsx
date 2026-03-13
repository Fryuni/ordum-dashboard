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
import { $groupTargets, type TargetItem } from "../../lib/group-craft-store";

interface Props {
  /** Pre-populated items from settlement planner (serialized as JSON in URL) */
  initialItems?: TargetItem[];
}

/**
 * Invisible component that initializes group craft targets from props
 * (which come from URL query parameters parsed server-side).
 */
export default function GroupCraftInit({ initialItems }: Props) {
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      $groupTargets.set(initialItems);
    }
  }, []);

  return null;
}
