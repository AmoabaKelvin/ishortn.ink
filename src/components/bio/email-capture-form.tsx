"use client";

import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { useId, useState } from "react";
import { z } from "zod";

import { subscriberEmailSchema } from "./email-capture";

import type { ResolvedBioTheme } from "./theme";
import type { CSSProperties, FormEvent } from "react";

const subscribeResponseSchema = z
  .object({ ok: z.boolean(), error: z.string().optional() })
  .catch({ ok: false });

/**
 * Email signup form on a bio page. Posts to /api/bio/subscribe and swaps to the
 * success message in place. In the builder preview (`preview`) nothing is sent:
 * a valid address just shows the success state, so owners can check the copy.
 */
export function EmailCaptureForm({
  blockId,
  heading,
  buttonLabel,
  successMessage,
  consentText,
  t,
  preview = false,
}: {
  blockId: number | string;
  heading: string;
  buttonLabel: string;
  successMessage: string;
  consentText: string | null;
  t: ResolvedBioTheme;
  preview?: boolean;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const parsed = subscriberEmailSchema.safeParse(email);
    if (!parsed.success) {
      return setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
    }
    if (consentText && !consent) return setError("Tick the box to agree before signing up.");
    setError(null);
    if (preview) return setStatus("done");

    setStatus("sending");
    try {
      const res = await fetch("/api/bio/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blockId, email, consent, website: honeypot }),
      });
      const body = subscribeResponseSchema.parse(await res.json().catch(() => null));
      if (res.ok && body.ok) return setStatus("done");
      setError(body.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setStatus("idle");
  }

  const isOutline = t.buttonVariant === "outline";
  const buttonStyle: CSSProperties = isOutline
    ? { borderRadius: t.buttonRadius, border: `1.5px solid ${t.accentColor}`, color: t.accentColor }
    : { borderRadius: t.buttonRadius, background: t.accentColor, color: t.accentTextColor };
  const fieldBorder = `color-mix(in srgb, ${t.textColor} 22%, transparent)`;

  return (
    <div
      className="rounded-xl px-4 py-5"
      style={{ border: `1px solid color-mix(in srgb, ${t.textColor} 12%, transparent)` }}
    >
      {status === "done" ? (
        <output className="flex items-center justify-center gap-2 break-words text-center text-sm font-medium motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
          <IconCircleCheck size={18} stroke={1.75} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0">{successMessage}</span>
        </output>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-2.5">
          <h2 id={`${id}-heading`} className="break-words text-center text-base font-semibold">
            {heading}
          </h2>
          <label htmlFor={`${id}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="block w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-current placeholder:opacity-50 focus-visible:ring-2 focus-visible:ring-current sm:text-sm"
            style={{ borderRadius: t.buttonRadius, border: `1px solid ${fieldBorder}` }}
          />
          {/* Honeypot: off-screen and skipped by keyboard and screen readers; bots fill it. */}
          <div aria-hidden="true" className="sr-only">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          {consentText && (
            <label
              className="flex items-start gap-2 text-left text-xs"
              style={{ color: t.mutedColor }}
            >
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setError(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ accentColor: t.accentColor }}
              />
              <span className="min-w-0 break-words">{consentText}</span>
            </label>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="flex w-full items-center justify-center break-words px-5 py-3.5 text-center text-sm font-medium shadow-sm transition-transform disabled:opacity-70 motion-safe:hover:-translate-y-0.5"
            style={buttonStyle}
          >
            {status === "sending" ? "Signing up…" : buttonLabel}
          </button>
          {error && (
            // The theme's own text colour: a fixed red can't stay readable on every background.
            <p
              id={`${id}-error`}
              role="alert"
              className="flex items-center justify-center gap-1.5 text-center text-xs font-medium"
            >
              <IconAlertCircle size={14} stroke={2} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
