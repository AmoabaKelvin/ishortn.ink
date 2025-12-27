"use client";

import { Plus, QrCode } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

export function QRCodeEmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50/80 to-white p-10 text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-blue-100/50 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
          <QrCode className="h-8 w-8 text-white" />
        </div>
      </div>
      <h3 className="mt-8 text-xl font-semibold tracking-tight text-gray-900">
        Create your first QR code
      </h3>
      <p className="mt-2 mb-8 max-w-sm text-sm text-gray-500 leading-relaxed">
        Generate custom QR codes to share your links in the physical world. Track scans and customize designs to match your brand.
      </p>
      <Button asChild className="h-11 gap-2 px-6 shadow-sm">
        <Link href="/dashboard/qrcodes/create">
          <Plus className="h-4 w-4" />
          Create QR Code
        </Link>
      </Button>
    </div>
  );
}




