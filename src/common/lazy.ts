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
 * Minimal replacements for @inox-tools/utils/lazy.
 * Lazy: evaluate once on first call.
 * LazyKeyed: memoize per-key.
 */

export const Lazy = {
  wrap<T>(fn: () => T): () => T {
    let value: T;
    let resolved = false;
    return () => {
      if (!resolved) {
        value = fn();
        resolved = true;
      }
      return value;
    };
  },
};

export const LazyKeyed = {
  wrap<K, V>(fn: (key: K) => V): (key: K) => V {
    const cache = new Map<K, V>();
    return (key: K) => {
      if (!cache.has(key)) cache.set(key, fn(key));
      return cache.get(key)!;
    };
  },
  of<V>(fn: (key: string) => V): { get(key: string): V } {
    const cache = new Map<string, V>();
    return {
      get(key: string): V {
        if (!cache.has(key)) cache.set(key, fn(key));
        return cache.get(key)!;
      },
    };
  },
};
