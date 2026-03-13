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
import { persistentAtom } from "@nanostores/persistent";
import { atom, onMount } from "nanostores";

export const $pageActive = atom(false);

const UPDATE_PERIOD = 5000;

export const $updateTimer = persistentAtom("updateTimer", Date.now(), {
  encode: (n) => n.toFixed(0),
  decode: (n) => Number.parseInt(n, 10),
});

if (!import.meta.env.SSR) {
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

  onMount($updateTimer, () => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const unbind = $pageActive.subscribe((active) => {
      clearInterval(interval);

      if (active) {
        const elapsed = Date.now() - $updateTimer.get();

        if (elapsed >= UPDATE_PERIOD) $updateTimer.set(Date.now());

        interval = setInterval(() => {
          $updateTimer.set(Date.now());
        }, 10000);
      } else {
      }
    });

    return () => {
      unbind();
      clearInterval(interval);
    };
  });
}
