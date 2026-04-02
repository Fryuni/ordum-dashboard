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

/**
 * Minimal Cloudflare D1 dialect for Kysely.
 *
 * Based on kysely-d1 v0.4.0 but drops the deprecated
 * `numUpdatedOrDeletedRows` field that triggers a warning in Kysely ≥0.28.
 */

import {
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
  type CompiledQuery,
} from "kysely";

// ─── Connection ─────────────────────────────────────────────────────────────────

class D1Connection implements DatabaseConnection {
  readonly #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const results = await this.#db
      .prepare(compiledQuery.sql)
      .bind(...compiledQuery.parameters)
      .all();

    if (results.error) {
      throw new Error(results.error);
    }

    const numAffectedRows =
      results.meta.changes > 0 ? BigInt(results.meta.changes) : undefined;

    return {
      insertId:
        results.meta.last_row_id == null
          ? undefined
          : BigInt(results.meta.last_row_id),
      rows: (results?.results as R[]) ?? [],
      numAffectedRows,
    };
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("D1 does not support streaming.");
  }
}

// ─── Driver ─────────────────────────────────────────────────────────────────────

class D1Driver implements Driver {
  readonly #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  async init(): Promise<void> {}
  async destroy(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new D1Connection(this.#db);
  }

  async beginTransaction(): Promise<void> {
    throw new Error("D1 does not support transactions.");
  }

  async commitTransaction(): Promise<void> {
    throw new Error("D1 does not support transactions.");
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error("D1 does not support transactions.");
  }

  async releaseConnection(): Promise<void> {}
}

// ─── Dialect ────────────────────────────────────────────────────────────────────

export interface D1DialectConfig {
  database: D1Database;
}

export class D1Dialect implements Dialect {
  readonly #config: D1DialectConfig;

  constructor(config: D1DialectConfig) {
    this.#config = config;
  }

  createDriver(): Driver {
    return new D1Driver(this.#config.database);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
