"use client";

import { toast } from "sonner";

import { api } from "@/trpc/react";

function UpgradeText() {
  const upgradeMutation = api.lemonsqueezy.createCheckoutUrl.useMutation({
    onSuccess: (url) => {
      window.open(url);
    },
  });

  const handleUpgrade = async () => {
    toast.promise(upgradeMutation.mutateAsync(), {
      loading: "Creating checkout session",
      success: "Checkout session created successfully",
      error: "Failed to create checkout session",
    });
  };

  return (
    <span className="text-blue-600 underline hover:cursor-pointer" onClick={handleUpgrade}>
      Upgrade your subscription
    </span>
  );
}

export default UpgradeText;
