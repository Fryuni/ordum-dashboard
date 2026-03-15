import {
  atom,
  computed,
  onMount,
  type AsyncValue,
  type ReadableAtom,
} from "nanostores";

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
    v.state === "loaded" ? v.value : dv,
  );
}
