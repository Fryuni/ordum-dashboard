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
 * Convex client singleton for use in nanostores and components.
 *
 * This is a ConvexReactClient so the same instance can be passed to
 * ConvexAuthProvider in the React tree. That way auth tokens set by
 * the provider flow through to queries, mutations, and actions made
 * from nanostores — one client, one auth state.
 */
import { ConvexReactClient } from "convex/react";
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string;

if (!CONVEX_URL) {
  throw new Error("VITE_CONVEX_URL is not set");
}

export const convexClient = new ConvexReactClient(CONVEX_URL);

/**
 * Call a Convex query (one-shot, no subscription).
 */
export function convexQuery<F extends FunctionReference<"query">>(
  fn: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  return convexClient.query(fn, args);
}

/**
 * Call a Convex mutation.
 */
export function convexMutation<F extends FunctionReference<"mutation">>(
  fn: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  return convexClient.mutation(fn, args);
}

/**
 * Call a Convex action.
 */
export function convexAction<F extends FunctionReference<"action">>(
  fn: F,
  args: FunctionArgs<F>,
): Promise<FunctionReturnType<F>> {
  return convexClient.action(fn, args);
}
