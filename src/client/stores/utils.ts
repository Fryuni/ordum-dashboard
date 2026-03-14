import { atom, onMount, type ReadableAtom } from "nanostores";

const NOOP = () => {};

export function selectorAtom<R extends string, T>(
  switcher: ReadableAtom<R>,
  cases: Partial<Record<R, ReadableAtom<T>>>,
): ReadableAtom<T | undefined> {
  const $atom = atom<T | undefined>();

  onMount($atom, () => {
    let innerUnbind: () => void = NOOP;
    const selectorUnbind = switcher.subscribe((caseBranch) => {
      // Unbind any prior binding
      innerUnbind();
      const selected = cases[caseBranch];
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
