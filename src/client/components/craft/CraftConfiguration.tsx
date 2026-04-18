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
import { useConvexAuth } from "convex/react";
import { $targets, $shareableUrl, clearAll } from "../../stores/craft";
import { $inventory, setVirtualFromScratch } from "../../stores/craftSource";
import InventorySourcePicker from "./InventorySourcePicker";
import ItemPicker from "./ItemPicker";
import ItemList from "./ItemList";

export default function CraftConfiguration() {
  const targets = useStore($targets);
  const shareableUrl = useStore($shareableUrl);
  const shareReady = shareableUrl.state === "ready";
  const [copied, setCopied] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const inventory = useStore($inventory);
  const hasRealInventory = inventory.size > 0;

  const handleShare = useCallback(async () => {
    if (!shareReady) return;
    await navigator.clipboard.writeText(shareableUrl.value.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareableUrl, shareReady]);

  return (
    <div class="planner-card">
      <InventorySourcePicker />

      <ItemPicker />
      <ItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          {isAuthenticated && (
            <button
              type="button"
              class="btn btn-secondary"
              onClick={setVirtualFromScratch}
              disabled={!hasRealInventory}
              title={
                hasRealInventory
                  ? "Snapshot your current inventory as ignored, so the planner treats everything as needed from scratch."
                  : "Waiting for inventory to load…"
              }
            >
              From Scratch
            </button>
          )}
          <button type="button" class="btn btn-secondary" onClick={clearAll}>
            Clear All
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={handleShare}
            disabled={!shareReady}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}
