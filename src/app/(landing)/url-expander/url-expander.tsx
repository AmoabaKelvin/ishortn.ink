"use client";

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconShieldCheck,
  IconShieldQuestion,
} from "@tabler/icons-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { buttonClass, cardClass, fieldClass, wellClass } from "../_components/site-primitives";
import { parseUrl } from "../_lib/parse-url";
import { useCopy } from "../_lib/use-copy";
import { EXPANDER_ERRORS, safetyMessage, splitUrl } from "./utils";

import type { ExpandResult } from "@/server/lib/url-expander/expand";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; result: Extract<ExpandResult, { ok: true }> };

export function UrlExpander() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const inputId = useId();
  const messageId = useId();
  const pending = useRef<AbortController>(undefined);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parseUrl(value).ok) {
      setState({ status: "error", error: EXPANDER_ERRORS.notAUrl });
      return;
    }

    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/url-expander", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: controller.signal,
      });
      // SAFETY: /api/url-expander always answers with an ExpandResult body.
      const result = (await response.json()) as ExpandResult;
      setState(result.ok ? { status: "done", result } : { status: "error", error: result.error });
    } catch {
      if (controller.signal.aborted) return;
      setState({ status: "error", error: EXPANDER_ERRORS.network });
    }
  };

  const loading = state.status === "loading";

  return (
    <div className={cn(cardClass, "mx-auto max-w-3xl p-2")}>
      <form onSubmit={submit} noValidate className="p-4 sm:p-6">
        <label htmlFor={inputId} className="text-base font-medium text-neutral-900 sm:text-sm">
          Short link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="bit.ly/3xYzAbC"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={state.status === "error"}
            aria-describedby={messageId}
            className={cn(fieldClass, "min-w-0 flex-1")}
          />
          <button
            type="submit"
            disabled={loading}
            className={cn(buttonClass({ size: "lg" }), "sm:mt-2")}
          >
            {loading ? "Expanding..." : "Expand link"}
          </button>
        </div>
        <div id={messageId} aria-live="polite" className="mt-2">
          {state.status === "error" ? (
            <p className="flex items-start gap-1.5 text-base text-red-600 sm:text-sm">
              <IconAlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          ) : (
            <p className="text-base text-neutral-600 sm:text-sm">
              {loading
                ? "Following redirects. This can take a few seconds."
                : "Works with Bitly, TinyURL, t.co, ishortn.ink and any other shortener."}
            </p>
          )}
        </div>
      </form>

      {state.status === "done" && <ExpandedLink result={state.result} />}
    </div>
  );
}

function ExpandedLink({ result }: { result: Extract<ExpandResult, { ok: true }> }) {
  const urlRef = useRef<HTMLParagraphElement>(null);
  const { state: copyState, copy } = useCopy(() => {
    if (urlRef.current) window.getSelection()?.selectAllChildren(urlRef.current);
  });
  const unsafe = result.safety.status === "unsafe";
  const { scheme, host, rest } = splitUrl(result.finalUrl);
  const redirects = result.hops.length - 1;

  return (
    <div className={cn(wellClass, "space-y-5 p-4 sm:p-6")} aria-live="polite">
      {/* Safety verdict */}
      <p
        className={cn(
          "flex items-start gap-2 text-base font-medium sm:text-sm",
          unsafe ? "text-red-600" : "text-neutral-900",
        )}
      >
        {result.safety.status === "unsafe" && (
          <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        {result.safety.status === "safe" && (
          <IconShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        {result.safety.status === "unknown" && (
          <IconShieldQuestion aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        {safetyMessage(result.safety)}
      </p>

      {/* Final destination */}
      <div>
        <h2 className="text-base font-medium text-neutral-900 sm:text-sm">Final destination</h2>
        <p
          ref={urlRef}
          className="mt-2 break-all rounded-[10px] bg-white px-3 py-2.5 font-mono text-sm text-neutral-600 shadow-site-btn"
        >
          {scheme}
          <span className="font-semibold text-neutral-900">{host}</span>
          {rest}
        </p>
        {result.note && <p className="mt-2 text-base text-neutral-600 sm:text-sm">{result.note}</p>}
        {result.mayRedirectAgain && (
          <p className="mt-2 text-base text-neutral-600 sm:text-sm">
            This page may redirect again in the browser.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy(result.finalUrl)}
            className={cn(buttonClass({ variant: "secondary" }), "gap-1.5")}
          >
            {copyState === "copied" ? (
              <IconCheck aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <IconCopy aria-hidden="true" className="size-4 shrink-0" />
            )}
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Press Ctrl+C" : "Copy"}
          </button>
          {!unsafe && (
            <a
              href={result.finalUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className={cn(buttonClass({ variant: "soft" }), "gap-1.5")}
            >
              <IconExternalLink aria-hidden="true" className="size-4 shrink-0" />
              Open link
            </a>
          )}
        </div>
      </div>

      {/* Hops */}
      <div>
        <h2 className="text-base font-medium text-neutral-900 sm:text-sm">
          {redirects === 0
            ? "No redirects"
            : `${redirects.toLocaleString()} ${redirects === 1 ? "redirect" : "redirects"}`}
        </h2>
        <ol className="mt-2 divide-y divide-neutral-950/[0.07] overflow-hidden rounded-[10px] bg-white shadow-site-btn">
          {result.hops.map((hop, i) => (
            <li key={`${i}-${hop.url}`} className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-px shrink-0 rounded-md bg-neutral-950/[0.06] px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums text-neutral-600">
                {hop.status}
              </span>
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-neutral-900">
                {hop.url}
                {hop.ishortn && (
                  <span className="ml-2 whitespace-nowrap font-sans text-xs text-neutral-500">
                    read from iShortn, no click counted
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
