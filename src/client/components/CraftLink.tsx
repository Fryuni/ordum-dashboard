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
import { useState, useEffect } from "preact/hooks";
import { buildCraftUrl } from "../lib/craftUrl";

interface CraftLinkProps {
  items: Array<{ itemType: string; itemId: number; quantity: number }>;
  class?: string;
}

export default function CraftLink({ items, class: cls }: CraftLinkProps) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    buildCraftUrl(items).then(setHref);
  }, [items]);

  if (items.length === 0 || !href) return null;

  return (
    <a
      href={href}
      class={`craft-link ${cls ?? ""}`}
      title="Open in Craft Planner"
    >
      ⚒️ Plan
    </a>
  );
}
