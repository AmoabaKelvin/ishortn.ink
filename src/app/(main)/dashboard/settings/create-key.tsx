"use client";

import { createAPIKey, revalidatePathForDashboard } from "@/actions/api-keys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useTransition } from "react";

const CreateAPIKey = () => {
  const [loading, startTransition] = useTransition();
  const [key, setKey] = useState<null | string>(null);

  const createKey = () => {
    startTransition(async () => {
      const key = await createAPIKey();

      if (key.result?.key) {
        setKey(key.result?.key);
      }
    });
  };

  const handleRevalidation = async () => {
    await revalidatePathForDashboard();
  };

  return (
    <div>
      <Button onClick={createKey} disabled={loading}>
        Create API Key
      </Button>

      <Dialog
        open={!!key}
        onOpenChange={() => {
          setKey(null);
          handleRevalidation();
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
            <code className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">
              {key}
            </code>
          </div>
          {/* <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter> */}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateAPIKey;
