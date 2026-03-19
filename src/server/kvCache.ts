import type { CacheLoader, CacheProvider } from "@croct/cache";

export class KVCacheProvider implements CacheProvider<string, string> {
  readonly #kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.#kv = kv;
  }

  async get(key: string, loader: CacheLoader<string, string>): Promise<string> {
    const res = await this.#kv.get(key, {
      type: "text",
      cacheTtl: 10000,
    });
    if (res === null) return loader(key);
    return res;
  }

  async delete(key: string): Promise<void> {
    await this.#kv.delete(key);
  }

  async set(key: string, value: any): Promise<void> {
    await this.#kv.put(key, JSON.stringify(value), { expirationTtl: 10000 });
  }
}
