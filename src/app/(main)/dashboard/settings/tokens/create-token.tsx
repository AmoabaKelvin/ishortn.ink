"use client";

import posthog from "posthog-js";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";

const GenerateTokenTrigger = () => {
  const createAPIKeyMutation = api.token.create.useMutation();
  const [key, setKey] = useState<null | string>(null);

  const createKey = () => {
    createAPIKeyMutation
      .mutateAsync({
        name: "New API Key",
      })
      .then(async (results) => {
        setKey(results[0]!.token);
        posthog.capture("api_key_created");
      })
      .catch(() => {
        // noop
        return;
      });
  };

  const handlePageRevalidate = async () => {
    await revalidateRoute("/dashboard/tokens");
  };

  return (
    <div>
      <Button onClick={createKey} disabled={createAPIKeyMutation.isLoading}>
        Create API Key
      </Button>

      <Dialog
        open={!!key}
        onOpenChange={async () => {
          setKey(null);
          await handlePageRevalidate();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Your API key is ready!</DialogTitle>
            <DialogDescription>
              Make sure you copy your API key now. You won&apos;t be able to see
              it again!
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <code className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              {key}
            </code>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateTokenTrigger;
