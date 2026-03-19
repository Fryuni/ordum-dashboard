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
import type { CacheLoader, CacheProvider } from "@croct/cache";

/**
 * A two-level cache: checks the fast (in-memory) cache first,
 * then falls back to the slow (KV) cache, then the loader.
 * Writes go to both levels.
 */
export class TieredCache<K, V> implements CacheProvider<K, V> {
  readonly #fast: CacheProvider<K, V>;
  readonly #slow: CacheProvider<K, V>;

  constructor(fast: CacheProvider<K, V>, slow: CacheProvider<K, V>) {
    this.#fast = fast;
    this.#slow = slow;
  }

  async get(key: K, loader: CacheLoader<K, V>): Promise<V> {
    return this.#fast.get(key, (k) => this.#slow.get(k, loader));
  }

  async set(key: K, value: V): Promise<void> {
    await Promise.all([this.#fast.set(key, value), this.#slow.set(key, value)]);
  }

  async delete(key: K): Promise<void> {
    await Promise.all([this.#fast.delete(key), this.#slow.delete(key)]);
  }
}
