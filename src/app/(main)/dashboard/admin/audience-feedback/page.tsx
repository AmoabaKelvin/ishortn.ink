"use client";

import { IconMail, IconMessage2, IconSpeakerphone } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAudienceFeedbackLabel } from "@/lib/audience-feedback/labels";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/utils/user-name";
import {
  audienceFeedbackAcquisitionChannelValues,
  audienceFeedbackPriorToolValues,
  audienceFeedbackRoleValues,
} from "@/server/api/routers/audience-feedback/audience-feedback.input";
import { api } from "@/trpc/react";

import { useCursorPages } from "../_components/use-cursor-pages";

import type { Plan } from "@/lib/billing/plans";
import type { AudienceFeedbackResponseFilter } from "@/server/api/routers/audience-feedback/audience-feedback.input";

type PlanFilter = Plan | "all";
type ChannelFilter = (typeof audienceFeedbackAcquisitionChannelValues)[number] | "all";
type PriorToolFilter = (typeof audienceFeedbackPriorToolValues)[number] | "all";
type RoleFilter = (typeof audienceFeedbackRoleValues)[number] | "all";

const planFilterOptions: PlanFilter[] = ["all", "free", "pro", "ultra"];

const responseFilterOptions: Array<{ value: AudienceFeedbackResponseFilter; label: string }> = [
  { value: "all", label: "All responses" },
  { value: "survey", label: "Full survey" },
  { value: "acquisition", label: "Acquisition prompt" },
];

const PLAN_BADGE_CLASSES = {
  ultra: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  pro: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  free: "bg-neutral-100 text-neutral-700 dark:bg-muted dark:text-neutral-300",
} satisfies Record<Plan, string>;

function withAllOption<T extends string>(
  values: readonly T[],
  allLabel: string,
): Array<{ value: T | "all"; label: string }> {
  return [
    { value: "all", label: allLabel },
    ...values.map((v) => ({ value: v, label: formatAudienceFeedbackLabel(v) })),
  ];
}

export default function AdminAudienceFeedbackPage() {
  const [response, setResponse] = useState<AudienceFeedbackResponseFilter>("all");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [priorTool, setPriorTool] = useState<PriorToolFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const pages = useCursorPages();
  const { cursor } = pages;

  const { data: stats, isLoading: statsLoading } = api.audienceFeedback.stats.useQuery({
    response,
  });

  const { data, isLoading } = api.audienceFeedback.list.useQuery({
    response,
    plan: plan === "all" ? undefined : plan,
    acquisitionChannel: channel === "all" ? undefined : channel,
    priorTool: priorTool === "all" ? undefined : priorTool,
    role: role === "all" ? undefined : role,
    cursor,
    limit: 20,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Audience Feedback
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Survey and acquisition prompt answers on who&apos;s using iShortn and how they got here
        </p>
      </div>

      <StatsGrid stats={stats} isLoading={statsLoading} />

      <div className="mt-8 mb-6 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Response"
          value={response}
          onChange={(v) => {
            setResponse(v);
            pages.reset();
          }}
          options={responseFilterOptions}
        />
        <FilterSelect
          label="Plan"
          value={plan}
          onChange={(v) => {
            setPlan(v);
            pages.reset();
          }}
          options={planFilterOptions.map((v) => ({
            value: v,
            label: v === "all" ? "All plans" : formatAudienceFeedbackLabel(v),
          }))}
        />
        <FilterSelect
          label="Channel"
          value={channel}
          onChange={(v) => {
            setChannel(v);
            pages.reset();
          }}
          options={withAllOption(audienceFeedbackAcquisitionChannelValues, "All channels")}
        />
        <FilterSelect
          label="Prior tool"
          value={priorTool}
          onChange={(v) => {
            setPriorTool(v);
            pages.reset();
          }}
          options={withAllOption(audienceFeedbackPriorToolValues, "All prior tools")}
        />
        <FilterSelect
          label="Role"
          value={role}
          onChange={(v) => {
            setRole(v);
            pages.reset();
          }}
          options={withAllOption(audienceFeedbackRoleValues, "All roles")}
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconMessage2
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            No responses match these filters
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {data.items.map((item) => (
              <SubmissionCard key={item.id} item={item} />
            ))}
          </div>

          {(data.nextCursor || pages.hasPrevious) && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={pages.previous}
                disabled={!pages.hasPrevious}
                className="h-8 text-[12px]"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => data.nextCursor && pages.next(data.nextCursor)}
                disabled={!data.nextCursor}
                className="h-8 text-[12px]"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type StatsData = {
  total: number;
  byPlan: Array<{ value: string | null; count: number }>;
  byChannel: Array<{ value: string | null; count: number }>;
  byPriorTool: Array<{ value: string | null; count: number }>;
  byRole: Array<{ value: string | null; count: number }>;
  byUseCase: Array<{ value: string | null; count: number }>;
  byMagicFeature: Array<{ value: string | null; count: number }>;
};

function StatsGrid({ stats, isLoading }: { stats: StatsData | undefined; isLoading: boolean }) {
  if (isLoading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-4">
        <div className="rounded-lg bg-neutral-100 dark:bg-muted p-2">
          <IconSpeakerphone
            size={18}
            stroke={1.5}
            className="text-neutral-700 dark:text-neutral-300"
          />
        </div>
        <div>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">Total responses</p>
          <p className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-foreground">
            {stats.total.toLocaleString("en-US")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownCard title="Plan" rows={stats.byPlan} total={stats.total} />
        <BreakdownCard title="Acquisition channel" rows={stats.byChannel} total={stats.total} />
        <BreakdownCard title="Prior tool" rows={stats.byPriorTool} total={stats.total} />
        <BreakdownCard title="Role" rows={stats.byRole} total={stats.total} />
        <BreakdownCard title="Use case" rows={stats.byUseCase} total={stats.total} />
        <BreakdownCard title="Most-loved feature" rows={stats.byMagicFeature} total={stats.total} />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ value: string | null; count: number }>;
  total: number;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && (
          <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">—</p>
        )}
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.value ?? "unknown"} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="text-neutral-700 dark:text-neutral-300">
                  {formatAudienceFeedbackLabel(row.value)}
                </span>
                <span className="tabular-nums text-neutral-400 dark:text-muted-foreground">
                  {row.count}
                  <span className="ml-1 text-[11px]">({pct}%)</span>
                </span>
              </div>
              <Progress value={pct} className="h-1" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SubmissionItem = {
  id: number;
  role: string | null;
  useCase: string | null;
  monthlyVolume: string | null;
  acquisitionChannel: string | null;
  acquisitionDetail: string | null;
  priorTool: string | null;
  switchReason: string | null;
  magicFeature: string | null;
  upgradeReason: string | null;
  upgradeBlocker: string | null;
  improvementWish: string | null;
  planSnapshot: Plan | null;
  submittedAt: Date | null;
  acquisitionAnsweredAt: Date | null;
  user?: { name: string | null; email: string | null; imageUrl: string | null } | null;
};

function SubmissionCard({ item }: { item: SubmissionItem }) {
  const name = displayName(item.user?.name);
  const userLabel =
    name && item.user?.email
      ? `${name} (${item.user.email})`
      : (item.user?.email ?? name ?? "Unknown user");
  // Acquisition-only rows answered just channel, detail and use case.
  const isFullSurvey = Boolean(item.submittedAt);
  const answeredAt = item.submittedAt ?? item.acquisitionAnsweredAt;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                item.planSnapshot ? PLAN_BADGE_CLASSES[item.planSnapshot] : PLAN_BADGE_CLASSES.free,
              )}
            >
              {formatAudienceFeedbackLabel(item.planSnapshot)}
            </span>
            {item.acquisitionAnsweredAt && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-muted dark:text-neutral-300">
                Acquisition prompt
              </span>
            )}
            <span className="min-w-0 break-all text-[12px] text-neutral-500 dark:text-neutral-400">
              {userLabel}
            </span>
            <span className="text-[11px] text-neutral-400 dark:text-muted-foreground">·</span>
            <span className="text-[11px] text-neutral-400 dark:text-muted-foreground">
              {answeredAt
                ? new Date(answeredAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>

          <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <Field label="Channel" value={item.acquisitionChannel} />
            <Field label="Use case" value={item.useCase} />
            {isFullSurvey && (
              <>
                <Field label="Role" value={item.role} />
                <Field label="Monthly links" value={item.monthlyVolume} />
                <Field label="Prior tool" value={item.priorTool} />
                <Field label="Loved feature" value={item.magicFeature} />
              </>
            )}
            {item.upgradeReason && <Field label="Upgrade reason" value={item.upgradeReason} />}
          </div>

          {(item.acquisitionDetail ||
            item.switchReason ||
            item.upgradeBlocker ||
            item.improvementWish) && (
            <div className="mt-4 space-y-3 border-t border-neutral-100 dark:border-border/50 pt-3">
              {item.acquisitionDetail && (
                <Quote label="Where exactly?" text={item.acquisitionDetail} />
              )}
              {item.switchReason && <Quote label="Why switched" text={item.switchReason} />}
              {item.upgradeBlocker && <Quote label="Upgrade blocker" text={item.upgradeBlocker} />}
              {item.improvementWish && (
                <Quote label="Improvement wish" text={item.improvementWish} />
              )}
            </div>
          )}
        </div>

        {item.user?.email && (
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-[12px]" asChild>
            <a
              href={`mailto:${item.user.email}?subject=${encodeURIComponent(
                "Quick follow-up from iShortn",
              )}&body=${encodeURIComponent(
                `Hi ${name ?? "there"},\n\nThanks for filling out the survey. I had a quick follow-up question:\n\n`,
              )}`}
            >
              <IconMail size={14} />
              Reply
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="shrink-0 text-neutral-400 dark:text-muted-foreground">{label}</span>
      <span className="text-neutral-700 dark:text-neutral-300">
        {formatAudienceFeedbackLabel(value)}
      </span>
    </div>
  );
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
        {text}
      </p>
    </div>
  );
}

type FilterSelectProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
};

function FilterSelect<T extends string>({ label, value, onChange, options }: FilterSelectProps<T>) {
  const select = (next: string) => {
    const option = options.find((opt) => opt.value === next);
    if (option) onChange(option.value);
  };
  return (
    <Select value={value} onValueChange={select}>
      <SelectTrigger className="h-9 w-auto min-w-[160px] text-[13px]">
        <span className="text-neutral-400 dark:text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
