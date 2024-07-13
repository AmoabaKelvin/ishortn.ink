import type { RouterOutputs } from "@/trpc/shared";

export function checkIfUserCanCreateMoreQRCodes(subDetails: RouterOutputs["subscriptions"]["get"]) {
  if (subDetails?.subscriptions && subDetails.subscriptions.status === "active") {
    return true;
  }

  const currentQrCodeCount = subDetails?.qrCodeCount;

  return currentQrCodeCount && currentQrCodeCount < 3;
}
