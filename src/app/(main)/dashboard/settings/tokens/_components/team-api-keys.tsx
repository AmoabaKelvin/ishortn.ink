"use client";

import { IconKey, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

import { CreateTokenDialog } from "./create-token";
import TokenCard from "./token-card";

import type { RouterOutputs } from "@/trpc/shared";

type TeamTokens = NonNullable<RouterOutputs["token"]["listTeam"]>;

/** The team workspace's own keys: everyone sees them, owners and admins manage them. */
export function TeamApiKeys({ teamTokens }: { teamTokens: TeamTokens }) {
  const { keys, canManage, active } = teamTokens;
  const createButton = canManage && active && (
    <CreateTokenDialog
      team
      trigger={
        keys.length === 0 ? (
          <Button className="mt-4 h-9 gap-1.5 bg-blue-600 text-[13px] hover:bg-blue-700">
            <IconPlus size={14} stroke={2} />
            Create Team API Key
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-9 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
          >
            <IconPlus size={14} stroke={1.5} />
            Create Team API Key
          </Button>
        )
      }
    />
  );

  if (keys.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
          <IconKey size={18} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
        </div>
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          No Team API Keys Yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-muted-foreground">
          {canManage
            ? "Team keys create and manage this workspace's links through the API, Zapier, n8n and MCP."
            : "Owners and admins can create keys that act in this workspace."}
        </p>
        {createButton}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
        {keys.map((key) => (
          <TokenCard key={key.id} token={key} team active={active} canRevoke={canManage} />
        ))}
      </div>
      {!canManage && (
        <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
          Only owners and admins can create or revoke team keys.
        </p>
      )}
      {createButton}
    </div>
  );
}
