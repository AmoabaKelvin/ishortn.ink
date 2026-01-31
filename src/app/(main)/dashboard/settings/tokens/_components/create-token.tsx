"use client";

import { useState } from "react";
import { Plus, Key, Copy, Check, AlertCircle, Loader2 } from "lucide-react";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

const GenerateTokenTrigger = () => {
  const createAPIKeyMutation = api.token.create.useMutation();
  const [key, setKey] = useState<null | string>(null);
  const [copied, setCopied] = useState(false);

  const createKey = () => {
    createAPIKeyMutation
      .mutateAsync({
        name: "New API Key",
      })
      .then(async (results) => {
        setKey(results[0]!.token);
        trackEvent(POSTHOG_EVENTS.API_KEY_CREATED);
      })
      .catch(() => {
        return;
      });
  };

  const handlePageRevalidate = async () => {
    await revalidateRoute("/dashboard/settings");
  };

  const handleCopy = async () => {
    if (key) {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      {/* Empty State */}
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
          <Key className="w-8 h-8 text-violet-600" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No API Key Yet
        </h3>
        <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-6">
          Create an API key to programmatically access your links, analytics, and more.
        </p>
        <Button
          onClick={createKey}
          disabled={createAPIKeyMutation.isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 h-10 shadow-sm transition-all duration-200 hover:shadow-md"
        >
          {createAPIKeyMutation.isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create API Key
        </Button>
      </div>

      {/* Success Dialog */}
      <Dialog
        open={!!key}
        onOpenChange={async () => {
          setKey(null);
          await handlePageRevalidate();
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl border-neutral-200">
          <DialogHeader>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl">Your API key is ready!</DialogTitle>
            <DialogDescription className="text-neutral-500">
              Copy and save it somewhere safe. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Key Display */}
            <div className="relative">
              <code className="block w-full rounded-xl bg-neutral-900 px-4 py-4 text-sm font-mono text-emerald-400 pr-20 break-all">
                {key}
              </code>
              <Button
                size="sm"
                onClick={handleCopy}
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 rounded-lg transition-all ${
                  copied
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-neutral-700 hover:bg-neutral-600"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  Store this key securely
                </p>
                <p className="text-amber-700/80 mt-0.5">
                  This key grants access to your account. Never share it or commit it to version control.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateTokenTrigger;
