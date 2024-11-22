"use client";

import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../../actions/revalidate-homepage";

import type { QuickLinkShorteningInput } from "@/server/api/routers/link/link.input";
export function QuickLinkShorteningForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickLinkShorteningInput>();

  const quickLinkShorteningMutation = api.link.quickShorten.useMutation({
    onSuccess() {
      toast.success("Link shortened successfully");
      reset({ url: "" });
      revalidateHomepage();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: QuickLinkShorteningInput) => {
    quickLinkShorteningMutation.mutate(data);
    await revalidateHomepage();
  };

  return (
    <Card className="p-6">
      <CardTitle className="text-xl font-semibold leading-tight text-gray-800">
        Quick Shorten
      </CardTitle>
      <p className="text-sm text-gray-500">
        Shorten a link quickly without any settings
      </p>
      <Input
        type="url"
        placeholder="Paste a link to shorten"
        className={cn(
          "mt-4 w-full",
          errors.url &&
            "border-red-500 placeholder:text-red-500 dark:border-red-400"
        )}
        {...register("url", { required: true })}
      />
      <Button
        className="w-full mt-4"
        onClick={handleSubmit(onSubmit)}
        disabled={quickLinkShorteningMutation.isLoading}
      >
        {quickLinkShorteningMutation.isLoading && (
          <Loader2 className="mr-2 animate-spin" />
        )}
        Shorten
      </Button>
    </Card>
  );
}
