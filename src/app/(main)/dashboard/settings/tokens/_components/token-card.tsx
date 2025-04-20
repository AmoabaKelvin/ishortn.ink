"use client";

import posthog from "posthog-js";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const TokenCard = ({
  start,
  createdAt,
  keyID,
}: {
  start: string;
  createdAt: number;
  keyID: number;
}) => {
  const deleteAPIKeyMutation = api.token.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/tokens");
      posthog.capture("api_key_revoked");
      toast.success("API Token revoked");
    },
  });

  const handleKeyRevoke = () => {
    deleteAPIKeyMutation.mutate({ id: keyID });
  };

  return (
    <div className="flex flex-col rounded-md border p-3">
      <div className="flex justify-between">
        <span>Key</span>
        <span>
          <code>{start}</code>
        </span>
      </div>
      <div className="flex justify-between">
        <span>Created</span>
        <span>
          {new Date(createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          variant={"destructive"}
          onClick={handleKeyRevoke}
          disabled={deleteAPIKeyMutation.isLoading}
        >
          Revoke Key
        </Button>
      </div>
    </div>
  );
};

export default TokenCard;
