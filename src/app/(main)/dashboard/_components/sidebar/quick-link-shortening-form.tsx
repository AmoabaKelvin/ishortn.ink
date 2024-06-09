"use client";

import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    },
  });

  const onSubmit = async (data: QuickLinkShorteningInput) => {
    quickLinkShorteningMutation.mutate(data);
    await revalidateHomepage();
  };

  return (
    <div className="rounded-md bg-gray-100/65 p-6">
      <h1 className="text-xl font-semibold leading-tight text-gray-800">Quick Shorten</h1>
      <p className="text-sm text-gray-500">Shorten a link quickly without any settings</p>
      <Input
        type="url"
        placeholder="Paste a link to shorten"
        className={cn(
          "mt-4 w-full",
          errors.url && "border-red-500 placeholder:text-red-500 dark:border-red-400",
        )}
        {...register("url", { required: true })}
      />
      <Button
        className="mt-4 w-full"
        onClick={handleSubmit(onSubmit)}
        disabled={quickLinkShorteningMutation.isLoading}
      >
        {quickLinkShorteningMutation.isLoading && <Loader2 className="mr-2 animate-spin" />}
        Shorten
      </Button>
    </div>
  );
}
