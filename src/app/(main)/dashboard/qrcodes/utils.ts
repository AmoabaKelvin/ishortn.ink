import type { RouterOutputs } from "@/trpc/shared";

export function checkIfUserCanCreateMoreQRCodes(subDetails: RouterOutputs["subscriptions"]["get"]) {
  console.log("subDetails", subDetails);
  if (subDetails && subDetails.status === "active") {
    return true;
  }

  const currentQrCodeCount = subDetails?.user?.qrCodeCount;

  console.log("Current QR Code Count", currentQrCodeCount);

  console.log("Can create more QR Codes", currentQrCodeCount && currentQrCodeCount < 3);

  return currentQrCodeCount && currentQrCodeCount < 3;
}
