-- Storage Audit D1 Schema
-- Tracks item deposits and withdrawals from claim inventories

CREATE TABLE IF NOT EXISTS storage_logs (
  id TEXT PRIMARY KEY,               -- BitJita log ID
  claim_id TEXT NOT NULL,
  player_entity_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  building_entity_id TEXT NOT NULL,
  building_name TEXT NOT NULL,
  item_type TEXT NOT NULL,           -- "Item" or "Cargo"
  item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_value REAL NOT NULL DEFAULT 0, -- market value per unit at ingestion time
  action TEXT NOT NULL,              -- "deposit" or "withdraw"
  timestamp TEXT NOT NULL            -- ISO timestamp from BitJita
);

CREATE INDEX IF NOT EXISTS idx_logs_claim_ts
  ON storage_logs(claim_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_claim_player
  ON storage_logs(claim_id, player_entity_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_claim_item
  ON storage_logs(claim_id, item_id, item_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_claim_player_item
  ON storage_logs(claim_id, player_entity_id, item_id, item_type, timestamp DESC);

-- Tracks fetch progress per building so we only request new pages
CREATE TABLE IF NOT EXISTS storage_fetch_state (
  claim_id TEXT NOT NULL,
  building_entity_id TEXT NOT NULL,
  newest_log_id TEXT,                -- cursor: newest log ID seen for this building
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (claim_id, building_entity_id)
);
