"use client";

import { QrCode } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

export function QRCodeEmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 p-8 text-center animate-in fade-in-50 dark:bg-slate-900/10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
        <QrCode className="h-10 w-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-tight">
        No QR Codes yet
      </h3>
      <p className="mt-2 mb-8 max-w-sm text-sm text-muted-foreground">
        Create your first QR code to share your links in the physical world.
        Track scans and customize designs.
      </p>
      <Button asChild>
        <Link href="/dashboard/qrcodes/create">Create QR Code</Link>
      </Button>
    </div>
  );
}




