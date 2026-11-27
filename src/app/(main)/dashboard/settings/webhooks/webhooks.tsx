"use client";

import { IconAlertTriangle, IconPlus, IconSparkles, IconWebhook } from "@tabler/icons-react";
import { useState } from "react";

import { RecordPlanLimitView } from "@/components/record-plan-limit-view";
import { Button } from "@/components/ui/button";
import { UpgradeCta } from "@/components/upgrade-cta";
import { getWebhookEndpointLimit } from "@/lib/billing/plans";

import { WebhookFormDialog } from "./webhook-form-dialog";
import { WebhookRow } from "./webhook-row";

import type { RouterOutputs } from "@/trpc/shared";

type WebhookList = RouterOutputs["webhook"]["list"];

function WebhooksProGate() {
  return (
    <div className="py-6 text-center">
      <RecordPlanLimitView limitKey="webhooks_page_view" />
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconWebhook
          size={18}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Webhooks are a Pro feature
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-muted-foreground">
        Upgrade to Pro or Ultra to get a signed request on your server whenever a link or domain
        changes.
      </p>
      <UpgradeCta
        requiredPlan="pro"
        source="webhooks"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
      >
        <IconSparkles size={14} stroke={2} />
        Upgrade to Pro
      </UpgradeCta>
    </div>
  );
}

export function Webhooks({ webhooks }: { webhooks: WebhookList }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { endpoints, limit, canManage } = webhooks;

  if (limit === 0 && endpoints.length === 0) return <WebhooksProGate />;

  const atLimit = endpoints.length >= limit;
  const createDialog = canManage && (
    <WebhookFormDialog open={createOpen} onOpenChange={setCreateOpen} />
  );

  if (endpoints.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
          <IconWebhook
            size={18}
            stroke={1.5}
            className="text-neutral-400 dark:text-muted-foreground"
          />
        </div>
        <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
          No endpoints yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12px] text-neutral-400 dark:text-muted-foreground">
          {canManage
            ? "Add an endpoint to get a signed request when links are created, updated or deleted, or a domain is verified."
            : "Only the team's owner and admins can add webhook endpoints."}
        </p>
        {canManage && (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-4 h-9 gap-1.5 bg-blue-600 text-[13px] hover:bg-blue-700"
          >
            <IconPlus size={14} stroke={2} />
            Add endpoint
          </Button>
        )}
        {createDialog}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
        {endpoints.map((endpoint) => (
          <WebhookRow key={endpoint.id} endpoint={endpoint} canManage={canManage} />
        ))}
      </div>
      {limit === 0 ? (
        // Endpoints kept after a downgrade: nothing is sent to them until the plan is back.
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
          <p className="min-w-0">
            Webhooks are a Pro feature, so events aren&apos;t sent to these endpoints.{" "}
            <UpgradeCta
              requiredPlan="pro"
              source="webhooks"
              className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
            >
              Upgrade
            </UpgradeCta>
          </p>
        </div>
      ) : canManage ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={atLimit}
            onClick={() => setCreateOpen(true)}
            className="h-9 w-fit gap-1.5 border-neutral-200 text-[13px] dark:border-border"
          >
            <IconPlus size={14} stroke={1.5} />
            Add endpoint
          </Button>
          <p className="text-[12px] tabular-nums text-neutral-400 dark:text-muted-foreground">
            {endpoints.length.toLocaleString()} of {limit.toLocaleString()} endpoints used
            {atLimit && limit < getWebhookEndpointLimit("ultra") && (
              <>
                {" "}
                &middot;{" "}
                <UpgradeCta
                  requiredPlan="ultra"
                  source="webhooks_limit"
                  className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Upgrade for more
                </UpgradeCta>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
          Only the team&apos;s owner and admins can manage webhooks.
        </p>
      )}
      {createDialog}
    </div>
  );
}
