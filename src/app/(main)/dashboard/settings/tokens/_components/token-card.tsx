"use client";

import { toast } from "sonner";
import { Key, Calendar, Trash2, Loader2 } from "lucide-react";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
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
      await revalidateRoute("/dashboard/settings");
      trackEvent(POSTHOG_EVENTS.API_KEY_REVOKED);
      toast.success("API Token revoked");
    },
  });

  const handleKeyRevoke = () => {
    deleteAPIKeyMutation.mutate({ id: keyID });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
      {/* Key Info */}
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
          <Key className="w-5 h-5 text-violet-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono bg-neutral-100 px-3 py-1.5 rounded-lg text-neutral-700 tracking-wide">
              {start}••••••••••••
            </code>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              Active
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm text-neutral-500">
            <Calendar className="w-3.5 h-3.5" />
            Created {new Date(createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Revoke Button */}
      <Button
        variant="outline"
        onClick={handleKeyRevoke}
        disabled={deleteAPIKeyMutation.isLoading}
        className="rounded-xl h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors group"
      >
        {deleteAPIKeyMutation.isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
        )}
        Revoke Key
      </Button>
    </div>
  );
};

export default TokenCard;
