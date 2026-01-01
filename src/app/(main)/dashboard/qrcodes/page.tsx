import { Plus } from "lucide-react";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            QR Codes
          </h1>
          <p className="text-sm text-gray-500">
            Create, manage, and track your QR codes
          </p>
        </div>

        {userCodes.length > 0 && (
          canCreateMoreQRCodes ? (
            <Button asChild className="h-10 gap-2 shadow-sm">
              <Link href="/dashboard/qrcodes/create">
                <Plus className="h-4 w-4" />
                Create QR Code
              </Link>
            </Button>
          ) : (
            <Button disabled className="h-10 gap-2">
              <Plus className="h-4 w-4" />
              Create QR Code
            </Button>
          )
        )}
      </div>

      {/* Upgrade Banner */}
      {!canCreateMoreQRCodes && userCodes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-amber-900">
                QR Code limit reached
              </p>
              <p className="text-xs text-amber-700">
                Upgrade your plan to create unlimited QR codes
              </p>
            </div>
            <UpgradeText text="Upgrade to Pro" />
          </div>
        </div>
      )}

      {/* Content */}
      {userCodes.length === 0 ? (
        <QRCodeEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {userCodes.map((qr) => (
            <QRCodeCard qr={qr} key={qr.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export default QRCodePage;
