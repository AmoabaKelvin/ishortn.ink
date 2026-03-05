import { IconPlus } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { api } from "@/trpc/server";

import { QRCodeEmptyState } from "./_components/empty-state-new";
import { QRCodeList } from "./_components/qrcode-list";
import UpgradeText from "./_components/upgrade-text";
import { checkIfUserCanCreateMoreQRCodes } from "./utils";

export const dynamic = "force-dynamic";

async function QRCodePage() {
  const userCodes = await api.qrCode.list.query();
  const subDetails = await api.subscriptions.get.query();
  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(subDetails);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            QR Codes
          </h2>
          {userCodes.length > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400">
              {userCodes.length}{" "}
              {userCodes.length === 1 ? "code" : "codes"} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userCodes.length > 0 &&
            (canCreateMoreQRCodes ? (
              <Link
                href="/dashboard/qrcodes/create"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                <IconPlus size={16} stroke={2} />
                New QR Code
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-400 cursor-not-allowed">
                <IconPlus size={16} stroke={2} />
                New QR Code
              </span>
            ))}
        </div>
      </div>

      {/* Upgrade Banner */}
      {!canCreateMoreQRCodes && userCodes.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-amber-900">
              QR code limit reached
            </p>
            <p className="mt-0.5 text-[12px] text-amber-700/80">
              Upgrade to create unlimited QR codes
            </p>
          </div>
          <UpgradeText text="Upgrade" />
        </div>
      )}

      {/* Content */}
      {userCodes.length === 0 ? (
        <QRCodeEmptyState />
      ) : (
        <QRCodeList codes={userCodes} />
      )}
    </div>
  );
}

export default QRCodePage;
