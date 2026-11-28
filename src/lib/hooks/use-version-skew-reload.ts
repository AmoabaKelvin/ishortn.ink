import { useEffect, useState } from "react";

import { getSessionStorage, markSkewReload, shouldReloadForSkew } from "@/lib/utils/version-skew";

// Module-level so the effect's dependency stays stable across renders.
const reloadPage = () => window.location.reload();

/**
 * For error boundaries: when the error comes from a stale build, reloads the page once and
 * returns true so the boundary can render nothing instead of flashing its error UI. Returns
 * false (show the error UI) for other errors, or when a reload already happened recently.
 */
export function useVersionSkewReload(error: Error, reload: () => void = reloadPage) {
  // Decided once per boundary mount. The read is pure, so Strict Mode's double call agrees.
  const [reloading] = useState(() => shouldReloadForSkew(error, getSessionStorage()));

  useEffect(() => {
    if (!reloading) return;
    const storage = getSessionStorage();
    if (storage) markSkewReload(storage);
    reload();
  }, [reloading, reload]);

  return reloading;
}
