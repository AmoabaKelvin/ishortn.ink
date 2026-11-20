import { useCallback, useState } from "react";

// Previous/Next over a cursor-paginated list: the stack holds the cursor of
// every page visited after the first, so Previous is a pop.
export function useCursorPages() {
  const [stack, setStack] = useState<number[]>([]);

  const next = useCallback((cursor: number) => setStack((s) => [...s, cursor]), []);
  const previous = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);

  return { cursor: stack.at(-1), hasPrevious: stack.length > 0, next, previous, reset };
}
