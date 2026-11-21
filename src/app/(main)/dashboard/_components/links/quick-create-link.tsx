"use client";

import { IconCheck, IconCopy, IconLink, IconQrcode } from "@tabler/icons-react";
import { Link as TransitionLink } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { copyToClipboard } from "@/lib/utils";
import { INVALID_URL_MESSAGE, normalizeDestinationUrl } from "@/lib/utils/destination-url";
import { api } from "@/trpc/react";

import { QRCodeModal } from "./link-card/qrcode-modal";

type QuickCreateLinkProps = {
  /** Called once a link exists, so the parent keeps this panel mounted across the list refresh. */
  onCreated: () => void;
};

/** One-field first-link form for an empty workspace (`link.quickShorten`). */
export function QuickCreateLink({ onCreated }: QuickCreateLinkProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Shares the cache entry the dashboard banner fills, so this adds no request.
  const { data: notice } = api.subscriptions.entitlementNotice.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const readOnly = notice?.type === "team" && notice.readOnly;

  // Autofocus only where there's a hardware keyboard; on phones it would open
  // the keyboard over the explanation before the user has read it.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, []);

  const quickShorten = api.link.quickShorten.useMutation({
    onSuccess: (data) => {
      setShortUrl(`https://${data.domain}/${data.alias}`);
      setUrl("");
      trackEvent(POSTHOG_EVENTS.LINK_QUICK_SHORTENED, { domain: data.domain, source: "dashboard" });
      onCreated();
      router.refresh();
    },
    onError: (mutationError) => {
      setError(mutationError.message);
      if (mutationError.data?.code === "FORBIDDEN" || /upgrade/i.test(mutationError.message)) {
        notifyPlanLimit(mutationError.message, "link_quick_create");
      }
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeDestinationUrl(url);
    if (!normalized) {
      setError(INVALID_URL_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    quickShorten.mutate({ url: normalized });
  };

  const shortenAnother = () => {
    setShortUrl(null);
    // The input mounts again on the next render.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (shortUrl) {
    const displayUrl = shortUrl.replace(/^https:\/\//, "");
    return (
      <div className="flex flex-col items-center py-12 text-center sm:py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
          <IconCheck size={24} stroke={1.5} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Your link is ready
        </p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          Share it anywhere. Clicks show up in analytics.
        </p>
        <div className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <a
            href={shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-blue-600 dark:border-border dark:bg-card dark:text-blue-400"
          >
            <span className="truncate">{displayUrl}</span>
          </a>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(shortUrl)}
              className="h-9 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
            >
              <IconCopy size={16} stroke={1.5} />
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQrOpen(true)}
              className="h-9 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
            >
              <IconQrcode size={16} stroke={1.5} />
              QR code
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={shortenAnother}
          className="mt-4 rounded-md text-[12px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-foreground"
        >
          Shorten another link
        </button>
        <QRCodeModal open={qrOpen} setOpen={setQrOpen} destinationUrl={shortUrl} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-12 text-center sm:py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconLink size={24} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        No links yet
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        {readOnly
          ? "Links created in this workspace will show up here."
          : "Shorten a long URL to get a link you can share and track."}
      </p>
      {!readOnly && (
        <>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1 text-left">
              <Input
                ref={inputRef}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Paste a long link"
                aria-label="Long link to shorten"
                aria-invalid={error !== null}
                aria-describedby={error ? "quick-create-error" : undefined}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) setError(null);
                }}
                className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
              />
              {error && (
                <p
                  id="quick-create-error"
                  role="alert"
                  className="mt-1.5 break-words text-[12px] text-red-500"
                >
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={quickShorten.isLoading}
              className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
            >
              {quickShorten.isLoading ? "Shortening..." : "Shorten"}
            </Button>
          </form>
          <TransitionLink
            href="/dashboard/link/new"
            className="mt-4 rounded-md text-[12px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-foreground"
          >
            More options (custom alias, tags, expiry…)
          </TransitionLink>
        </>
      )}
    </div>
  );
}
