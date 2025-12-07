import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";

import { QRCodeEmptyState } from "./_components/empty-state-new";
import { QRCodeCard } from "./_components/qrcode-card-new";
import UpgradeText from "./_components/upgrade-text";
import { checkIfUserCanCreateMoreQRCodes } from "./utils";

export const dynamic = "force-dynamic";

async function QRCodePage() {
  const userCodes = await api.qrCode.list.query();
  const subDetails = await api.subscriptions.get.query();
  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(subDetails);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            QR Codes
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Manage and track your QR codes.
          </p>
        </div>

        {userCodes.length > 0 && (
          canCreateMoreQRCodes ? (
            <Button asChild>
              <Link href="/dashboard/qrcodes/create">Create QR Code</Link>
            </Button>
          ) : (
            <Button disabled>Create QR Code</Button>
          )
        )}
      </div>

      {/* Upgrade Warning */}
      {!canCreateMoreQRCodes && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-center justify-between">
          <p className="text-sm font-medium">
            You have reached the maximum number of QR Codes allowed.
          </p>
          <UpgradeText text="Upgrade to Pro" />
        </div>
      )}

      {/* Content */}
      {userCodes.length === 0 ? (
        <QRCodeEmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {userCodes.map((qr) => (
            <QRCodeCard qr={qr} key={qr.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export default QRCodePage;
