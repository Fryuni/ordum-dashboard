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
import { useCallback, useState } from "preact/hooks";
import { $targets, $shareableUrl, clearAll } from "../../stores/craft";
import InventorySourcePicker from "./InventorySourcePicker";
import ItemPicker from "./ItemPicker";
import ItemList from "./ItemList";

export default function CraftConfiguration() {
  const targets = useStore($targets);
  const shareableUrl = useStore($shareableUrl);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareableUrl) return;
    await navigator.clipboard.writeText(shareableUrl.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareableUrl]);

  return (
    <div class="planner-card">
      <InventorySourcePicker />

      <ItemPicker />
      <ItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onClick={clearAll}>
            Clear All
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={handleShare}
            disabled={!shareableUrl}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}
