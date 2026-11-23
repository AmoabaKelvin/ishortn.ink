"use client";

import { IconLogout } from "@tabler/icons-react";

import { useSignOut } from "@/components/scripts/posthog-identify";

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <button
      onClick={() => void signOut()}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      <IconLogout size={15} stroke={1.5} />
      Sign out
    </button>
  );
}
