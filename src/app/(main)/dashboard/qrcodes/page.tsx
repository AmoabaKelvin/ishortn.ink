import Link from "next/link";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";

import EmptyState from "./empty-state";
import QRCodeDisplay from "./qrcode-card";
import UpgradeText from "./upgrade-text";

import type { RouterOutputs } from "@/trpc/shared";

export function checkIfUserCanCreateMoreQRCodes(subDetails: RouterOutputs["subscriptions"]["get"]) {
  if (subDetails && subDetails.status === "active") {
    return true;
  }

  const currentQrCodeCount = subDetails?.user?.qrCodeCount;
  return currentQrCodeCount && currentQrCodeCount < 3;
}

async function QRCodePage() {
  const userCodes = await api.qrCode.list.query();
  const subDetails = await api.subscriptions.get.query();
  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(subDetails);

  return (
    <div>
      {userCodes.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl">Your QR Codes</h1>
            {canCreateMoreQRCodes ? (
              <Button asChild>
                <Link href="/dashboard/qrcodes/create">Create QR Code</Link>
              </Button>
            ) : (
              <Button disabled>Create QR Code</Button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {!canCreateMoreQRCodes && (
              <div className="rounded-lg bg-red-100 p-4 text-red-800">
                You have reached the maximum number of QR Codes allowed. Please upgrade your
                subscription to create more QR Codes. <UpgradeText />
              </div>
            )}
            {userCodes.map((qr) => (
              <QRCodeDisplay qr={qr} key={qr.content} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default QRCodePage;
