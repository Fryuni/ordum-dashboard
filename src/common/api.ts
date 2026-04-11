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
import BitJitaClient from "./bitjita-client";

/**
 * Resolve the BitJita base URL.
 *
 * In the browser the client calls through a proxy whose URL is provided
 * at build time via `VITE_PROXY_URL`.  On the server (SSR / scripts) it
 * falls back to the upstream API directly.
 */
function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    const url = (import.meta as any).env?.VITE_PROXY_URL as string | undefined;
    if (!url) {
      throw new Error(
        "VITE_PROXY_URL is not set — the static client needs a proxy URL to reach the BitJita API",
      );
    }
    return url;
  }
  return "https://bitjita.com";
}

/** Global API client instance. Server-side caching is handled by the proxy layer. */
export const jita = new BitJitaClient({
  baseUrl: resolveBaseUrl(),
  timeout: 15_000,
});
