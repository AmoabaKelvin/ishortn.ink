import type { RouterOutputs } from "@/trpc/shared";

// The subscription payload carries no QR code usage count, so no per-plan QR limit is enforced yet.
export function checkIfUserCanCreateMoreQRCodes(
  subDetails: RouterOutputs["subscriptions"]["get"] | undefined,
) {
  return subDetails !== undefined;
}
