"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-9 flex-1 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
    >
      {pending ? "Connecting..." : "Connect"}
    </Button>
  );
}
