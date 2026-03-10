"use client";

import { motion } from "framer-motion";
import {
  IconClick,
  IconExternalLink,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { daysSinceDate } from "@/lib/utils";

import { QRCodeActions } from "./qrcode-actions";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeCardProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  index: number;
};

export function QRCodeCard({ qr, index }: QRCodeCardProps) {
  const daysSinceCreation = daysSinceDate(new Date(qr.createdAt!));
  const scans = qr.visitCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div className="group relative px-1 py-4 transition-colors">
        <div className="flex items-center gap-4">
          {/* QR Code Thumbnail */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-white p-1.5 transition-all duration-200 group-hover:border-neutral-200 group-hover:shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qrCode!}
              alt="QR Code"
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-neutral-900">
                {qr.title || "Untitled QR Code"}
              </span>
            </div>

            {/* Metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400">
                {daysSinceCreation === 0
                  ? "Today"
                  : `${daysSinceCreation}d`}
              </span>

              <span className="text-neutral-300">&middot;</span>

              {qr.link ? (
                <Link
                  href={`/dashboard/qrcodes/${qr.id}`}
                  className="inline-flex items-center gap-1 text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
                >
                  <span className="max-w-[200px] truncate sm:max-w-[300px]">
                    {qr.link.url}
                  </span>
                  <IconExternalLink
                    size={12}
                    stroke={1.5}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              ) : (
                <span className="max-w-[200px] truncate text-neutral-500 sm:max-w-[300px]">
                  {qr.content}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/dashboard/qrcodes/${qr.id}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] tabular-nums text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <IconClick size={14} stroke={1.5} />
              <span className="font-medium">{scans}</span>
            </Link>

            <div className="w-7">
              {qr.link && (
                <div className="opacity-0 transition-opacity group-hover:opacity-100">
                  <QRCodeActions qr={qr} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
