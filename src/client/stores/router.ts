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
import { createRouter } from "@nanostores/router";
import { computed } from "nanostores";

export const $router = createRouter({
  dashboard: "/",
  settlement: "/settlement",
  construction: "/construction",
  craft: "/craft",
  travelerTask: "/traveler-task",
  storageAudit: "/storage-audit",
  inventorySearch: "/inventory-search",
  signIn: "/sign-in",
});

export const $routeName = computed($router, (r) => r?.route ?? "unknown");
