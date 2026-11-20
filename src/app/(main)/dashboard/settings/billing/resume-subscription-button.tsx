"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type ResumeSubscriptionButtonProps = {
  className?: string;
};

export function ResumeSubscriptionButton({ className }: ResumeSubscriptionButtonProps) {
  const resume = api.lemonsqueezy.resumeSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button
      type="button"
      onClick={() => resume.mutate()}
      disabled={resume.isLoading}
      className={cn("bg-blue-600 text-white hover:bg-blue-700", className)}
    >
      {resume.isLoading && <IconLoader2 size={14} stroke={2} className="mr-1.5 animate-spin" />}
      {resume.isLoading ? "Resuming..." : "Resume subscription"}
    </Button>
  );
}
