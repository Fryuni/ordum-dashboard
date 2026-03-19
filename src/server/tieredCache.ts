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
