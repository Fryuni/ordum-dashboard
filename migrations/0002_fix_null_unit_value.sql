-- Fix any NULL unit_value rows from the scheduler ingestion.
-- SQLite ALTER TABLE ADD COLUMN doesn't enforce NOT NULL on existing rows,
-- and INSERT with explicit column list may store NULL if the value wasn't provided.
UPDATE storage_logs SET unit_value = 0 WHERE unit_value IS NULL;
