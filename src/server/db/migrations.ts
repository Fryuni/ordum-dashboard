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

import { sql } from "kysely";
import type { Kysely } from "kysely";

// ─── Migration Definition ───────────────────────────────────────────────────────

interface Migration {
  name: string;
  up(db: Kysely<any>): Promise<void>;
}

/**
 * Ordered list of all migrations. Append new migrations at the end.
 * Each migration runs once and is recorded in the `_migrations` table.
 *
 * Use Kysely's schema builder (`db.schema`) for DDL and `db.insertInto` /
 * `db.updateTable` / `sql` for DML. Avoid `db.introspection` — D1 blocks
 * the `pragma_table_info()` table function it relies on.
 */
const MIGRATIONS: Migration[] = [
  {
    name: "0001_initial_schema",
    async up(db) {
      await db.schema
        .createTable("storage_logs")
        .ifNotExists()
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("claim_id", "text", (col) => col.notNull())
        .addColumn("player_entity_id", "text", (col) => col.notNull())
        .addColumn("player_name", "text", (col) => col.notNull())
        .addColumn("building_entity_id", "text", (col) => col.notNull())
        .addColumn("building_name", "text", (col) => col.notNull())
        .addColumn("item_type", "text", (col) => col.notNull())
        .addColumn("item_id", "integer", (col) => col.notNull())
        .addColumn("item_name", "text", (col) => col.notNull())
        .addColumn("quantity", "integer", (col) => col.notNull())
        .addColumn("action", "text", (col) => col.notNull())
        .addColumn("timestamp", "text", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("storage_fetch_state")
        .ifNotExists()
        .addColumn("claim_id", "text", (col) => col.notNull())
        .addColumn("building_entity_id", "text", (col) => col.notNull())
        .addColumn("newest_log_id", "text")
        .addColumn("updated_at", "text", (col) =>
          col.defaultTo(sql.raw(`(datetime('now'))`)),
        )
        .execute();

      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_fetch_state_pk
        ON storage_fetch_state(claim_id, building_entity_id)`.execute(db);

      await db.schema
        .createIndex("idx_logs_claim_ts")
        .ifNotExists()
        .on("storage_logs")
        .columns(["claim_id", "timestamp"])
        .execute();

      await db.schema
        .createIndex("idx_logs_claim_player")
        .ifNotExists()
        .on("storage_logs")
        .columns(["claim_id", "player_entity_id", "timestamp"])
        .execute();

      await db.schema
        .createIndex("idx_logs_claim_item")
        .ifNotExists()
        .on("storage_logs")
        .columns(["claim_id", "item_id", "item_type", "timestamp"])
        .execute();

      await db.schema
        .createIndex("idx_logs_claim_player_item")
        .ifNotExists()
        .on("storage_logs")
        .columns([
          "claim_id",
          "player_entity_id",
          "item_id",
          "item_type",
          "timestamp",
        ])
        .execute();
    },
  },

  {
    name: "0002_add_unit_value",
    async up(db) {
      await sql`ALTER TABLE storage_logs ADD COLUMN unit_value REAL DEFAULT 0`.execute(
        db,
      );
      await db
        .updateTable("storage_logs" as any)
        .set({ unit_value: 0 } as any)
        .where("unit_value" as any, "is", null)
        .execute();
    },
  },
];

// ─── Migrator ───────────────────────────────────────────────────────────────────

/** The latest migration name — used for the fast-path check. */
const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1]!.name;

/**
 * Run all pending migrations. Safe to call on every request — returns
 * immediately if the DB is already up-to-date.
 *
 * Uses a simple `_migrations` tracking table instead of Kysely's built-in
 * Migrator, which relies on `pragma_table_info()` that D1 blocks.
 */
export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  // Ensure tracking table exists
  await db.schema
    .createTable("_migrations")
    .ifNotExists()
    .addColumn("name", "text", (col) => col.primaryKey())
    .addColumn("applied_at", "text", (col) =>
      col.notNull().defaultTo(sql.raw(`(datetime('now'))`)),
    )
    .execute();

  // Fast path: check if the latest migration is already applied
  const latest = await sql<{
    name: string;
  }>`SELECT name FROM _migrations WHERE name = ${LATEST_MIGRATION}`.execute(db);
  if (latest.rows.length > 0) return;

  // Get all applied migration names
  const applied =
    await sql<{ name: string }>`SELECT name FROM _migrations`.execute(db);
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  // Run pending migrations in order
  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.name)) continue;

    console.log(`[db] Applying migration: ${migration.name}`);
    await migration.up(db);
    await sql`INSERT INTO _migrations (name) VALUES (${migration.name})`.execute(
      db,
    );
  }
}
