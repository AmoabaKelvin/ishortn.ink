import type { RouterOutputs } from "@/trpc/shared";

export function checkIfUserCanCreateMoreQRCodes(
  subDetails: RouterOutputs["subscriptions"]["get"] | undefined
) {
  if (!subDetails) {
    return false;
  }

  if (subDetails?.subscriptions && subDetails.subscriptions.status === "active") {
    return true;
  }

  // Free users can create up to 5 QR codes
  const usage = subDetails.usage as { qrCodeCount?: number } | undefined;
  const currentQrCodeCount = usage?.qrCodeCount ?? 0;

  return currentQrCodeCount < 5;
}
