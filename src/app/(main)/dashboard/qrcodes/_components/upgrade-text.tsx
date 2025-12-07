"use client";

import { toast } from "sonner";

import { api } from "@/trpc/react";

// we can use custom text or the default one
type UpgradeTextProps = {
  text?: string;
};

function UpgradeText({ text }: UpgradeTextProps) {
  const upgradeMutation = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect" && data.url) {
        window.open(data.url);
      }
    },
  });

  const handleUpgrade = async () => {
    toast.promise(upgradeMutation.mutateAsync({ plan: "pro" }), {
      loading: "Creating checkout session",
      success: "Checkout session created successfully",
      error: "Failed to create checkout session",
    });
  };

  return (
    <button 
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
      onClick={handleUpgrade}
    >
      {text ?? "Upgrade your subscription"}
    </button>
  );
}

export default UpgradeText;
