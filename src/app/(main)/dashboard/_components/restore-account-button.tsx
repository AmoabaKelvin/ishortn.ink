"use client";

import { IconLoader2, IconRotateClockwise } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/trpc/react";

export function RestoreAccountButton() {
  const router = useRouter();

  const restore = api.accountDeletion.restore.useMutation({
    onSuccess: () => {
      toast.success("Welcome back — your account and links are active again.");
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "Couldn't restore your account"),
  });

  return (
    <button
      type="button"
      onClick={() => restore.mutate()}
      disabled={restore.isLoading}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
    >
      {restore.isLoading ? (
        <IconLoader2 size={15} stroke={1.5} className="animate-spin" />
      ) : (
        <IconRotateClockwise size={15} stroke={1.5} />
      )}
      Restore my account
    </button>
  );
}
