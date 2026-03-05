"use client";

import { AnimatePresence } from "framer-motion";

import { QRCodeCard } from "./qrcode-card-new";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeListProps = {
  codes: RouterOutputs["qrCode"]["list"];
};

export function QRCodeList({ codes }: QRCodeListProps) {
  return (
    <div className="divide-y divide-neutral-300/60">
      <AnimatePresence>
        {codes.map((qr, index) => (
          <QRCodeCard qr={qr} index={index} key={qr.id} />
        ))}
      </AnimatePresence>
    </div>
  );
}
