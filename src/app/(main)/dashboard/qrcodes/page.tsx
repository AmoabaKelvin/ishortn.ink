import { IconPlus } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { UpgradeCta } from "@/components/upgrade-cta";
import { nextPlanFor } from "@/lib/billing/upgrade";
import { api } from "@/trpc/server";

import { QRCodeEmptyState } from "./_components/empty-state-new";
import { QRCodeList } from "./_components/qrcode-list";
import { checkIfUserCanCreateMoreQRCodes } from "./utils";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "QR Codes" };

export const dynamic = "force-dynamic";

async function QRCodePage() {
  const [userCodes, subDetails] = await Promise.all([
    api.qrCode.list.query(),
    api.subscriptions.get.query(),
  ]);
  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(subDetails);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            QR Codes
          </h2>
          {userCodes.length > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
              {userCodes.length} {userCodes.length === 1 ? "code" : "codes"} total
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
              <span className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 dark:bg-muted px-4 py-2 text-[13px] font-medium text-neutral-400 dark:text-muted-foreground cursor-not-allowed">
                <IconPlus size={16} stroke={2} />
                New QR Code
              </span>
            ))}
        </div>
      </div>

      {/* Upgrade Banner */}
      {!canCreateMoreQRCodes && userCodes.length > 0 && (
        <div className="mb-6 flex flex-col items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
              QR code limit reached
            </p>
            <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-400">
              Upgrade to create unlimited QR codes
            </p>
          </div>
          <UpgradeCta
            requiredPlan={nextPlanFor(subDetails.plan)}
            source="qr_limit"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            Upgrade
          </UpgradeCta>
        </div>
      )}

      {/* Content */}
      {userCodes.length === 0 ? <QRCodeEmptyState /> : <QRCodeList codes={userCodes} />}
    </div>
  );
}

export default QRCodePage;
