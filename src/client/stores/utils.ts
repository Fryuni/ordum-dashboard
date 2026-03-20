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
import { atom, computed, onMount, type ReadableAtom } from "nanostores";
import type { AsyncValue } from "@nanostores/async";

const NOOP = () => {};

export function selectorAtom<R extends string, T>(
  switcher: ReadableAtom<R>,
  cases: Partial<Record<R, ReadableAtom<T>>>,
): ReadableAtom<T | undefined>;
export function selectorAtom<R extends string, T>(
  switcher: ReadableAtom<R>,
  cases: Partial<Record<R, ReadableAtom<T>>>,
  fallback: ReadableAtom<T>,
): ReadableAtom<T>;
export function selectorAtom<R extends string, T>(
  switcher: ReadableAtom<R>,
  cases: Partial<Record<R, ReadableAtom<T>>>,
  fallback?: ReadableAtom<T>,
): ReadableAtom<T | undefined> {
  const $atom = atom<T | undefined>(fallback?.value);

  onMount($atom, () => {
    let innerUnbind: () => void = NOOP;
    const selectorUnbind = switcher.subscribe((caseBranch) => {
      // Unbind any prior binding
      innerUnbind();
      const selected = cases[caseBranch] ?? fallback;
      if (selected) {
        innerUnbind = selected.subscribe($atom.set);
      } else {
        $atom.set(undefined);
        innerUnbind = NOOP;
      }
    });

    return () => {
      selectorUnbind();
      innerUnbind();
    };
  });

  return $atom;
}

export function asyncDefaultValue<T>(
  $store: ReadableAtom<AsyncValue<T>>,
  $defaultValue: ReadableAtom<T>,
): ReadableAtom<T> {
  return computed([$store, $defaultValue], (v, dv) =>
    v.state === "ready" ? v.value : dv,
  );
}
