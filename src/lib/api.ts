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
import {
  AdaptedCache,
  LruCache,
  SharedInFlightCache,
  StaleWhileRevalidateCache,
  type CacheProvider,
} from "@croct/cache";
import { hash } from "ohash";
import { BitcraftApiClient } from "../bitcraft-api-client";

export const API_BASE_URL = import.meta.env.SSR
  ? "https://craft-api.resubaka.dev"
  : `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/api`;

const apiCache: CacheProvider<any, any> = AdaptedCache.transformKeys(
  new SharedInFlightCache(
    new StaleWhileRevalidateCache({
      freshPeriod: 20,
      cacheProvider: LruCache.ofCapacity(1 << 15),
    }),
  ),
  hash,
);

class CachedClient extends BitcraftApiClient {
  protected async request<T>(path: string): Promise<T> {
    return apiCache.get(path, (p) => super.request(p));
  }
}

/** Global API client instance — used server-side by all pages and actions. */
export const api = new CachedClient({
  baseUrl: API_BASE_URL,
  timeout: 60_000,
});
