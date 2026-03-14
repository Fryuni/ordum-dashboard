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
import { ResubakaClient } from "./resubaka-client";

/** On the server this resolves to the upstream API; on the client it proxies through our server. */
export const API_BASE_URL =
  typeof window === "undefined"
    ? "https://craft-api.resubaka.dev"
    : `${window.location.origin}/api`;

/** Global API client instance. Server-side caching is handled by the proxy layer. */
export const api = new ResubakaClient({
  baseUrl: API_BASE_URL,
  timeout: 60_000,
});
