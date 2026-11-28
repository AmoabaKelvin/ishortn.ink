"use client";

import { IconCheck, IconClick, IconClock, IconExternalLink } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useMemo } from "react";

import { STATIC_PAYLOAD_LABELS, staticPayloadSummary } from "@/lib/qr-generator/payload";
import { VCARD_LABEL, vcardSummary } from "@/lib/qr-generator/vcard";
import { cn, daysSinceDate } from "@/lib/utils";

import { qrPreviewSrc, staticTypeOf, vcardOf } from "../utils";
import { QRCodeActions } from "./qrcode-actions";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeCardProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  index: number;
  selected: boolean;
  /** Some code is selected, so every row shows its checkbox. */
  isSelectionMode: boolean;
  onToggleSelected: (id: number) => void;
};

export function QRCodeCard({
  qr,
  index,
  selected,
  isSelectionMode,
  onToggleSelected,
}: QRCodeCardProps) {
  const previewSrc = useMemo(() => qrPreviewSrc(qr), [qr]);
  const daysSinceCreation = daysSinceDate(new Date(qr.createdAt!));
  // Static codes encode their content directly, so there are no scans to count.
  const staticType = staticTypeOf(qr);
  const card = vcardOf(qr);
  const typeLabel = staticType ? STATIC_PAYLOAD_LABELS[staticType] : card ? VCARD_LABEL : null;
  const scans = qr.visitCount ?? 0;
  // Codes made by a CSV import encode a visible link, so the count is all of that link's clicks.
  const countLabel =
    qr.link && !qr.link.isQrCode
      ? `${scans.toLocaleString()} ${scans === 1 ? "click" : "clicks"} on this link`
      : `${scans.toLocaleString()} ${scans === 1 ? "scan" : "scans"}`;
  const activateAt = qr.link?.activateAt;
  const scheduledFor =
    activateAt && new Date(activateAt) > new Date() ? new Date(activateAt) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div
        className={cn(
          "group relative px-1 py-4 transition-colors",
          selected && "bg-neutral-50 dark:bg-accent/50",
        )}
      >
        <div className="flex items-center gap-4">
          {/* Checkbox */}
          <div
            className={cn(
              "flex shrink-0 items-center transition-all duration-150",
              // Hidden, the negative margin cancels the row gap so the thumbnail keeps its place.
              isSelectionMode
                ? "w-5 opacity-100"
                : "-mr-4 w-0 overflow-hidden opacity-0 group-focus-within:mr-0 group-focus-within:w-5 group-focus-within:opacity-100 group-hover:mr-0 group-hover:w-5 group-hover:opacity-100 [@media(hover:none)]:mr-0 [@media(hover:none)]:w-5 [@media(hover:none)]:opacity-100",
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`Select ${qr.title || "QR code"}`}
              onClick={() => onToggleSelected(qr.id)}
              className={cn(
                "flex h-[18px] w-[18px] items-center justify-center rounded border-[1.5px] transition-colors",
                selected
                  ? "border-blue-600 bg-blue-600"
                  : "border-neutral-300 bg-white hover:border-neutral-400 dark:border-border dark:bg-card",
              )}
            >
              {selected && <IconCheck size={11} stroke={3} className="text-white" />}
            </button>
          </div>

          {/* QR Code Thumbnail */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-100 dark:border-border/50 bg-white dark:bg-card p-1.5 transition-all duration-200 group-hover:border-neutral-200 group-hover:shadow-sm">
            {previewSrc && (
              // eslint-disable-next-line next/no-img-element -- generated QR data: URL
              <img
                src={previewSrc}
                alt="QR Code"
                className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
              />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                {qr.title || "Untitled QR Code"}
              </span>
              {typeLabel && (
                <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 dark:border-border dark:bg-accent/50 dark:text-neutral-400">
                  {typeLabel}
                </span>
              )}
            </div>

            {/* Metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400 dark:text-muted-foreground">
                {daysSinceCreation === 0 ? "Today" : `${daysSinceCreation}d`}
              </span>

              <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>

              {qr.link ? (
                <Link
                  href={`/dashboard/qrcodes/${qr.id}`}
                  className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline dark:hover:text-foreground"
                >
                  {/* A contact card's link is its hosted page; the card's name says more. */}
                  <span className="max-w-[200px] truncate sm:max-w-[300px]">
                    {card ? vcardSummary(card) : qr.link.url}
                  </span>
                  <IconExternalLink
                    size={12}
                    stroke={1.5}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              ) : (
                <span className="max-w-[200px] truncate text-neutral-500 dark:text-neutral-400 sm:max-w-[300px]">
                  {qr.payloadFields && qr.payloadFields.type !== "vcard"
                    ? staticPayloadSummary(qr.payloadFields)
                    : qr.content}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {scheduledFor && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-500/30 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400"
                title={`Goes live ${scheduledFor.toLocaleString()}`}
              >
                <IconClock size={12} stroke={1.5} />
                Scheduled
              </span>
            )}

            {!staticType && (
              <Link
                href={`/dashboard/qrcodes/${qr.id}`}
                aria-label={countLabel}
                title={countLabel}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900 dark:hover:text-foreground"
              >
                <IconClick size={14} stroke={1.5} />
                <span className="font-medium">{scans.toLocaleString()}</span>
              </Link>
            )}

            <div className="w-7 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <QRCodeActions qr={qr} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
