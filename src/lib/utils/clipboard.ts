import { toast } from "sonner";

// Apart from @/lib/utils: sonner has import side effects, so it would ship with every client
// component that only needs `cn`, including the auth pages and link status pages.
export function showSuccessToast() {
  toast.success("Copied to clipboard", {
    duration: 2000,
  });
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  showSuccessToast();
}
