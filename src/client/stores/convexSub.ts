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
 * Reactive Convex query subscription for nanostores.
 *
 * Creates a nanostore that stays in sync with a Convex query via WebSocket.
 * When dependency stores change, the subscription is re-created with new args.
 * Matches the { state, value } shape of @nanostores/async computedAsync.
 */
import {
  atom,
  computed,
  onMount,
  type ReadableAtom,
  type WritableAtom,
} from "nanostores";
import { convexClient } from "../convex";
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";
import type { AsyncValue } from "@nanostores/async";

/**
 * Subscribe to a Convex query with reactive arguments derived from
 * dependency stores. Returns a readable atom with loading/ready/error states
 * that matches the computedAsync interface used by page components.
 *
 * The subscription is only active while the store has listeners (onMount).
 * When args change the old subscription is torn down and a new one starts.
 *
 * @param deps - Dependency stores whose values are passed to computeArgs
 * @param computeArgs - Derives query args from dependency values. Return null to skip.
 * @param queryFn - The Convex query function reference
 */
export function convexSub<
  F extends FunctionReference<"query">,
  T = FunctionReturnType<F>,
>(
  deps: ReadableAtom[],
  queryFn: F,
  computeArgs: (...values: any[]) => FunctionArgs<F> | null,
): ReadableAtom<AsyncValue<T>> {
  const $store: WritableAtom<AsyncValue<T>> = atom({ state: "loading" });

  // A derived atom that serialises the current args (or null to skip)
  const $args = computed(deps, (...values) => computeArgs(...values));

  onMount($store, () => {
    let unsub: (() => void) | null = null;

    const unwatch = $args.subscribe((args) => {
      unsub?.();
      unsub = null;

      $store.set({ state: "loading" });

      if (args === null) {
        return;
      }

      const watch = convexClient.watchQuery(queryFn, args);
      const emit = () => {
        try {
          const result = watch.localQueryResult();
          if (result === undefined) return;
          $store.set({ state: "ready", value: result as T, changing: false });
        } catch (error) {
          $store.set({
            state: "failed",
            error: error as Error,
            changing: false,
          });
        }
      };
      unsub = watch.onUpdate(emit);
      // Watch.onUpdate doesn't fire for an already-cached result — emit now
      // so a re-subscription with known args resolves immediately.
      emit();
    });

    return () => {
      unwatch();
      unsub?.();
    };
  });

  return $store;
}
