"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function AddCustomDomainModal() {
  const { data: userSubscription } = api.subscriptions.get.useQuery();

  const [domain, setDomain] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const createCustomDomainMutation = api.customDomain.create.useMutation({
    onSuccess: async () => {
      toast.success("Domain added successfully");
      await revalidateRoute("/dashboard/settings/domains");
    },
  });
  const createCheckoutMutation = api.lemonsqueezy.createCheckoutUrl.useMutation(
    {
      onSuccess: async (data) => {
        window.location.href = data!;
      },
    }
  );

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
  };

  const handleUpgrade = async () => {
    toast.promise(createCheckoutMutation.mutateAsync(), {
      loading: "Creating checkout session...",
      success: "Checkout session created successfully",
      error: "Failed to create checkout session",
    });
  };

  const handleCreateDomain = () => {
    if (!domain) {
      return;
    }

    toast.promise(createCustomDomainMutation.mutateAsync({ domain }), {
      loading: "Adding domain...",
      success: "Domain added successfully",
      error: "Failed to add domain",
    });
  };

  const isProUser = userSubscription?.subscriptions?.status === "active";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {isProUser ? "Add New Domain" : "Upgrade to Add Domain"}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-[425px]", satoshi.className)}>
        <DialogHeader>
          <DialogTitle>Add domain</DialogTitle>
          <DialogDescription>
            Add a new custom domain for your account.
          </DialogDescription>
        </DialogHeader>
        {isProUser ? (
          <motion.div
            className="mt-2 flex flex-col gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="flex flex-col gap-1" variants={itemVariants}>
              <Label htmlFor="name">Domain</Label>
              <Input
                id="name"
                className="w-full"
                placeholder="example.com"
                value={domain}
                onChange={handleDomainChange}
              />
            </motion.div>
            <motion.div
              variants={itemVariants}
              className="mt-1 text-sm text-yellow-600"
            >
              Tip: If there's already content on your domain, consider using a
              subdomain like "links.example.com".
            </motion.div>
            <motion.div
              variants={itemVariants}
              className="mt-2 text-sm text-gray-500"
            >
              <h4 className="mb-1 font-semibold">Quick Guide:</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Ensure you own or have permission to use this domain.</li>
                <li>
                  You'll need to configure DNS settings after adding the domain.
                </li>
                <li>Verification may take up to 24 hours to complete.</li>
              </ul>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            className="mt-2 text-center"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <p className="text-yellow-600">
              Custom domains are only available for pro users. Please upgrade
              your plan to add a custom domain.
            </p>
          </motion.div>
        )}
        <DialogFooter>
          {isProUser ? (
            <Button
              type="submit"
              className="mt-3 w-full"
              onClick={handleCreateDomain}
              disabled={!domain || createCustomDomainMutation.isLoading}
            >
              Add Domain
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={handleUpgrade}
            >
              Upgrade to Pro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
