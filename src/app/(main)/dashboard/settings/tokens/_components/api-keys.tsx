"use client";

import { IconKey, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

import { CreateTokenDialog } from "./create-token";
import TokenCard from "./token-card";

import type { RouterOutputs } from "@/trpc/shared";

export function ApiKeys({ tokens }: { tokens: RouterOutputs["token"]["list"] }) {
  if (tokens.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
          <IconKey size={18} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          No API Key Yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-neutral-500">
          Create an API key to programmatically access your links, analytics, and more.
        </p>
        <CreateTokenDialog
          trigger={
            <Button className="mt-4 h-9 gap-1.5 bg-blue-600 text-[13px] hover:bg-blue-700">
              <IconPlus size={14} stroke={2} />
              Create API Key
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
        {tokens.map((token) => (
          <TokenCard key={token.id} token={token} />
        ))}
      </div>
      <CreateTokenDialog
        trigger={
          <Button
            variant="outline"
            className="h-9 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
          >
            <IconPlus size={14} stroke={1.5} />
            Create API Key
          </Button>
        }
      />
    </div>
  );
}
