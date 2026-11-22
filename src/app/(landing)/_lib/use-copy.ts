import { useEffect, useRef, useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

/** Copy with a 2 s "Copied" label; when the clipboard API is refused, select the text instead. */
export const useCopy = (selectFallback: () => void) => {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (text: string) => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      selectFallback();
      setState("failed");
    }
  };
  return { state, copy, reset: () => setState("idle") };
};
