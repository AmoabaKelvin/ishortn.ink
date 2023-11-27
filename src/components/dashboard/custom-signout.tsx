"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const { signOut } = useClerk();

  // For some reason, the default logout button for clerk doesn't work
  // So I made this custom one

  return (
    <button onClick={() => signOut(() => router.push("/"))}>
      <LogOut className="w-6 h-6 text-gray-600" />
    </button>
  );
}
