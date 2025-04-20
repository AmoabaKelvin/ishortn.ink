"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { QuickLinkShorteningInput } from "@/server/api/routers/link/link.input";
export function QuickLinkShorteningForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickLinkShorteningInput>();

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const quickLinkShorteningMutation = api.link.quickShorten.useMutation({
    onSuccess() {
      toast.success("Link shortened successfully");
      reset({ url: "" });
      setTags([]);
      setTagInput("");
      setShowTagInput(false);
      revalidateHomepage();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
        setTagInput("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const onSubmit = async (data: QuickLinkShorteningInput) => {
    quickLinkShorteningMutation.mutate({
      ...data,
      tags,
    });
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

      {showTagInput ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <div
                key={tag}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-md"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <Input
            placeholder="Add tags (press Enter to add)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            className="mb-2"
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          className="mt-2 text-sm text-gray-500 p-0 h-auto"
          onClick={() => setShowTagInput(true)}
        >
          + Add tags
        </Button>
      )}

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
