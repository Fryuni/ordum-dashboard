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

/** Minimum KV expirationTtl in seconds (Cloudflare enforces >= 60). */
const KV_EXPIRATION_TTL = 300; // 5 minutes

export class KVCacheProvider implements CacheProvider<string, string> {
  readonly #kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.#kv = kv;
  }

  async get(key: string, loader: CacheLoader<string, string>): Promise<string> {
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
