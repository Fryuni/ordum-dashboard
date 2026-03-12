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
