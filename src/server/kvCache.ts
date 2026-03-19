import type { CacheLoader, CacheProvider } from "@croct/cache";

/** Minimum KV expirationTtl in seconds (Cloudflare enforces >= 60). */
const KV_EXPIRATION_TTL = 300; // 5 minutes

export class KVCacheProvider implements CacheProvider<string, string> {
  readonly #kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.#kv = kv;
  }

  async get(
    key: string,
    loader: CacheLoader<string, string>,
  ): Promise<string> {
    const res = await this.#kv.get(key, { type: "text", cacheTtl: 60 });
    if (res !== null) return res;
    return loader(key);
  }

  async delete(key: string): Promise<void> {
    await this.#kv.delete(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.#kv.put(key, value, { expirationTtl: KV_EXPIRATION_TTL });
  }
}
