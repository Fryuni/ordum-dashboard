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
  type CacheProvider,
} from "@croct/cache";
import { hash } from "ohash";
import { ResubakaClient } from "../common/resubaka-client";
import BitJitaClient from "../common/bitjita-client";

class CachedResubaka extends ResubakaClient {
  #apiCache: CacheProvider<any, any> = AdaptedCache.transformKeys(
    new SharedInFlightCache(
      new StaleWhileRevalidateCache({
        freshPeriod: 20,
        cacheProvider: LruCache.ofCapacity(1 << 15),
      }),
    ),
    hash,
  );

  protected async request<T>(path: string): Promise<T> {
    return this.#apiCache.get(path, (p) => super.request(p));
  }
}

class CachedBitJita extends BitJitaClient {
  #apiCache: CacheProvider<any, any> = AdaptedCache.transformKeys(
    new SharedInFlightCache(
      new StaleWhileRevalidateCache({
        freshPeriod: 20,
        cacheProvider: LruCache.ofCapacity(1 << 15),
      }),
    ),
    hash,
  );

  protected async request<T>(path: string): Promise<T> {
    return this.#apiCache.get(path, (p) => super.request(p));
  }
}

/** Server-side cached API client for direct upstream calls. */
export const serverResubaka = new CachedResubaka({
  baseUrl: "https://craft-api.resubaka.dev",
  timeout: 60_000,
});

export const serverJita = new CachedBitJita({
  baseUrl: "https://bitjita.com",
  timeout: 15_000,
});
