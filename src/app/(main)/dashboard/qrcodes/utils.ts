import type { RouterOutputs } from "@/trpc/shared";

// While the subscription is loading (or failed to load) creation stays allowed: the server enforces
// the limit on create, and blocking on an unknown state would lock out users who are under it.
export function checkIfUserCanCreateMoreQRCodes(
  subDetails: RouterOutputs["subscriptions"]["get"] | undefined,
) {
  const qrCodes = subDetails?.usage.qrCodes;
  if (!qrCodes || qrCodes.limit === null) return true;
  return qrCodes.count < qrCodes.limit;
}

export function qrCodeFileName(title: string | null | undefined, extension = "png") {
  const slug = (title ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${slug || "qr-code"}.${extension}`;
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
