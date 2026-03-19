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
import { atom, effect, onMount, type ReadableAtom } from "nanostores";
import { hash } from "ohash";

export const $pageActive = atom(false);

const UPDATE_PERIOD = 5000;

export const $updateTimer = atom(Date.now());

export function skipShallowChange<T>($atom: ReadableAtom<T>): ReadableAtom<T> {
  const noShallow = atom<T>($atom.value!);
  let lastHash = "";
  onMount(noShallow, () =>
    $atom.subscribe((newValue) => {
      const newHash = hash(newValue);
      if (newHash !== lastHash) {
        noShallow.set(newValue);
        lastHash = newHash;
      }
    }),
  );
  return noShallow;
}

onMount($pageActive, () => {
  $pageActive.set(document.visibilityState === "visible");

  const abort = new AbortController();
  document.addEventListener(
    "visibilitychange",
    () => {
      $pageActive.set(document.visibilityState === "visible");
    },
    { signal: abort.signal },
  );

  return () => abort.abort();
});

onMount($updateTimer, () =>
  effect($pageActive, (active) => {
    if (!active) return;

    const elapsed = Date.now() - $updateTimer.get();

    if (elapsed >= UPDATE_PERIOD) $updateTimer.set(Date.now());

    const interval = setInterval(() => {
      $updateTimer.set(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }),
);
