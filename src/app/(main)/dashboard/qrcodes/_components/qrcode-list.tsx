"use client";

import { IconFileZip, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

import { UpgradeCta } from "@/components/upgrade-cta";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { nextPlanFor } from "@/lib/billing/upgrade";

import { buildQrZip } from "../qr-export";
import { qrZipBaseNames, savedQrCodeSvgState, saveBlob } from "../utils";
import { QRCodeCard } from "./qrcode-card-new";

import type { Plan } from "@/lib/billing/plans";
import type { RouterOutputs } from "@/trpc/shared";

type QRCodeListProps = {
  codes: RouterOutputs["qrCode"]["list"];
  plan: Plan;
  /** Codes per ZIP: 0 when bulk QR isn't on the plan, null when unlimited. */
  bulkLimit: number | null;
};

export function QRCodeList({ codes, plan, bulkLimit }: QRCodeListProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  // Drop codes deleted since they were selected.
  const selected = codes.filter((qr) => selectedIds.includes(qr.id));
  const allSelected = selected.length === codes.length;

  const toggleSelected = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
    );

  const overLimit = bulkLimit !== null && selected.length > bulkLimit;

  const handleDownloadZip = () => {
    const names = qrZipBaseNames(
      selected.map((qr) => ({ alias: qr.link?.alias, title: qr.title })),
    );
    const items = selected.map((qr, index) => ({
      name: names[index]!,
      state: savedQrCodeSvgState(qr),
      storedPng: qr.qrCode
        ? async () => {
            // Same-origin copy of the stored image (the bucket sends no CORS headers).
            const response = await fetch(`/api/qr-codes/${qr.id}/png`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return new Uint8Array(await response.arrayBuffer());
          }
        : undefined,
    }));

    setIsZipping(true);
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "zip", count: items.length });
    toast.promise(
      buildQrZip(items)
        .then((zip) => {
          saveBlob(zip, "ishortn-qr-codes.zip");
          setSelectedIds([]);
        })
        .finally(() => setIsZipping(false)),
      {
        loading: `Preparing ${items.length.toLocaleString()} QR ${items.length === 1 ? "code" : "codes"}...`,
        success: "ZIP downloaded",
        error: "Couldn't create the ZIP. Please try again.",
      },
    );
  };

  return (
    <>
      <div className="divide-y divide-neutral-300/60 dark:divide-border">
        <AnimatePresence>
          {codes.map((qr, index) => (
            <QRCodeCard
              qr={qr}
              index={index}
              key={qr.id}
              selected={selectedIds.includes(qr.id)}
              isSelectionMode={selected.length > 0}
              onToggleSelected={toggleSelected}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2"
          >
            <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-lg dark:border-border dark:bg-card">
              {/* Count */}
              <div className="flex items-center gap-2 px-2.5 py-1">
                <div className="flex h-6 min-w-6 items-center justify-center rounded-md bg-blue-600 px-1">
                  <span className="text-[11px] font-semibold tabular-nums text-white">
                    {selected.length.toLocaleString()}
                  </span>
                </div>
                <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                  selected
                </span>
              </div>

              <div className="h-5 w-px bg-neutral-200 dark:bg-border" />

              {/* Actions */}
              <div className="flex items-center gap-0.5 px-1">
                <button
                  type="button"
                  onClick={() => setSelectedIds(allSelected ? [] : codes.map((qr) => qr.id))}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-accent/50 dark:hover:text-foreground"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                {bulkLimit === 0 || overLimit ? (
                  <>
                    <span className="hidden px-1.5 text-[12px] text-neutral-500 dark:text-neutral-400 sm:inline">
                      {overLimit
                        ? `Up to ${bulkLimit.toLocaleString()} per ZIP on your plan`
                        : "ZIP downloads are on Pro"}
                    </span>
                    <UpgradeCta
                      requiredPlan={nextPlanFor(plan)}
                      source="bulk_qr"
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <IconFileZip size={15} stroke={2} />
                      Upgrade
                    </UpgradeCta>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={isZipping}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <IconFileZip size={15} stroke={2} />
                    {isZipping ? "Preparing..." : "Download as ZIP"}
                  </button>
                )}

                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelectedIds([])}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-muted-foreground dark:hover:bg-accent"
                >
                  <IconX size={15} stroke={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
