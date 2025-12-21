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
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">QR Codes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track your QR codes.
          </p>
        </div>

        {userCodes.length > 0 && (
          canCreateMoreQRCodes ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/dashboard/qrcodes/create">Create QR Code</Link>
            </Button>
          ) : (
            <Button disabled>Create QR Code</Button>
          )
        )}
      </div>

      {!canCreateMoreQRCodes && (
        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-center justify-between">
          <p className="text-sm font-medium">
            You have reached the maximum number of QR Codes allowed.
          </p>
          <UpgradeText text="Upgrade to Pro" />
        </div>
      )}

      {userCodes.length === 0 ? (
        <div className="mt-8">
          <QRCodeEmptyState />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {userCodes.map((qr) => (
            <QRCodeCard qr={qr} key={qr.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export default QRCodePage;
