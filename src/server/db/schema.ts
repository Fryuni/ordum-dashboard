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

import type { Generated } from "kysely";

// ─── Table Types ────────────────────────────────────────────────────────────────

export interface StorageLogsTable {
  id: string;
  claim_id: string;
  player_entity_id: string;
  player_name: string;
  building_entity_id: string;
  building_name: string;
  item_type: string;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_value: Generated<number>;
  action: string;
  timestamp: string;
}

export interface StorageFetchStateTable {
  claim_id: string;
  building_entity_id: string;
  newest_log_id: string | null;
  updated_at: Generated<string | null>;
}

// ─── Database Interface ─────────────────────────────────────────────────────────

export interface Database {
  storage_logs: StorageLogsTable;
  storage_fetch_state: StorageFetchStateTable;
}
