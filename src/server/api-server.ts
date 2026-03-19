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
 * Server-side cached API client.
 * Uses @croct/cache for stale-while-revalidate caching of upstream API calls.
 * This module should only be imported from server-side code.
 */
import {
  AdaptedCache,
  LruCache,
  SharedInFlightCache,
  StaleWhileRevalidateCache,
  TimestampedCacheEntry,
  type CacheProvider,
} from "@croct/cache";
import { hash } from "ohash";
import BitJitaClient from "../common/bitjita-client";
import { KVCacheProvider } from "./kvCache";
import { TieredCache } from "./tieredCache";

export function buildCache(
  kv?: KVNamespace,
  freshPeriod = 20,
): CacheProvider<any, any> {
  const storage: CacheProvider<string, string> = kv
    ? new TieredCache(LruCache.ofCapacity(1 << 15), new KVCacheProvider(kv))
    : LruCache.ofCapacity(1 << 15);

  return AdaptedCache.transformKeys(
    new SharedInFlightCache(
      new StaleWhileRevalidateCache({
        freshPeriod,
        cacheProvider: AdaptedCache.transformValues(
          storage,
          TimestampedCacheEntry.toJSON,
          TimestampedCacheEntry.fromJSON,
        ),
      }),
    ),
    hash,
  );
}

class CachedBitJita extends BitJitaClient {
  #apiCache: CacheProvider<any, any>;

  constructor(options: { baseUrl: string; timeout: number }, kv?: KVNamespace) {
    super(options);
    this.#apiCache = buildCache(kv);
  }

  protected async request<T>(path: string): Promise<T> {
    return this.#apiCache.get(path, (p) => super.request(p));
  }
}

const CLIENT_OPTIONS = { baseUrl: "https://bitjita.com", timeout: 15_000 };

/** Create a cached BitJita client backed by the given KV namespace. */
export function createServerJita(kv: KVNamespace): CachedBitJita {
  return new CachedBitJita(CLIENT_OPTIONS, kv);
}

/**
 * Fallback server-side cached BitJita client (in-memory only).
 * Prefer {@link createServerJita} when a KV binding is available.
 */
export const serverJita = new CachedBitJita(CLIENT_OPTIONS);
