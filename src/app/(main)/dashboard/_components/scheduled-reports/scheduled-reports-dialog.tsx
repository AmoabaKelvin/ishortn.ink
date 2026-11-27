"use client";

import { IconMail, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UpgradeCta } from "@/components/upgrade-cta";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { isPlanLimitError, requiredPlanForLimit } from "@/lib/billing/required-plan";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { useUpgradeOffer } from "../upgrade-offer";
import { parseRecipients } from "./recipients";

import type { RouterInputs, RouterOutputs } from "@/trpc/shared";
import type { FormEvent } from "react";

export type ScheduledReportTarget = RouterInputs["scheduledReport"]["list"];

type Report = RouterOutputs["scheduledReport"]["list"]["reports"][number];
type Frequency = Report["frequency"];

const UPGRADE_SOURCE = "scheduled_report";

const FREQUENCIES = {
  weekly: { title: "Weekly", detail: "Every Monday, covering the week before" },
  monthly: { title: "Monthly", detail: "On the 1st, covering the month before" },
} satisfies Record<Frequency, { title: string; detail: string }>;

const DESCRIPTIONS = {
  link: "Email this link's clicks, countries, devices and sources to up to 5 people. They don't need an account.",
  folder:
    "Email this folder's clicks, top links, countries, devices and sources to up to 5 people. They don't need an account.",
  campaign:
    "Email this campaign's clicks, top links, countries, devices and sources to up to 5 people. They don't need an account.",
} satisfies Record<ScheduledReportTarget["targetType"], string>;

const sentFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type ScheduledReportsDialogProps = ScheduledReportTarget & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Lists, creates, edits and deletes the emailed report schedules of one link, folder or campaign. */
export function ScheduledReportsDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: ScheduledReportsDialogProps) {
  const target = { targetType, targetId };
  const utils = api.useUtils();
  const upgradeOffer = useUpgradeOffer();
  // null: the list; "new": the create form; a report: its edit form.
  const [editing, setEditing] = useState<Report | "new" | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [recipients, setRecipients] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Report | null>(null);

  const list = api.scheduledReport.list.useQuery(target, { enabled: open });

  const onMutationError = (error: { message: string; data?: { code?: string } | null }) => {
    if (isPlanLimitError(error)) {
      notifyPlanLimit(
        error.message,
        UPGRADE_SOURCE,
        requiredPlanForLimit(error.message, list.data?.plan),
        upgradeOffer,
      );
    } else {
      toast.error(error.message);
    }
  };

  const create = api.scheduledReport.create.useMutation({
    onSuccess: () => {
      toast.success("Report scheduled");
      setEditing(null);
      void utils.scheduledReport.list.invalidate(target);
    },
    onError: onMutationError,
  });

  const update = api.scheduledReport.update.useMutation({
    onSuccess: () => {
      toast.success("Report updated");
      setEditing(null);
      void utils.scheduledReport.list.invalidate(target);
    },
    onError: onMutationError,
  });

  const remove = api.scheduledReport.delete.useMutation({
    onSuccess: () => {
      toast.success("Report deleted");
      void utils.scheduledReport.list.invalidate(target);
    },
    onError: (error) => toast.error(error.message),
  });

  const openForm = (report: Report | "new") => {
    setEditing(report);
    setFrequency(report === "new" ? "monthly" : report.frequency);
    setRecipients(report === "new" ? "" : report.recipients.join("\n"));
    setFieldError(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setEditing(null);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseRecipients(recipients);
    if ("error" in parsed) {
      setFieldError(parsed.error);
      return;
    }
    setFieldError(null);
    if (editing === "new") create.mutate({ ...target, frequency, recipients: parsed.emails });
    else if (editing) update.mutate({ id: editing.id, frequency, recipients: parsed.emails });
  };

  const data = list.data;
  const isFree = data?.limit === 0;
  const hasPaused = !!data?.reports.some((report) => report.paused);
  const atLimit = !!data && data.limit !== null && data.used >= data.limit;
  const saving = create.isLoading || update.isLoading;
  const unsubscribedInForm =
    editing && editing !== "new"
      ? editing.unsubscribed.filter((email) => editing.recipients.includes(email))
      : [];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editing === "new"
                ? "New email report"
                : editing
                  ? "Edit email report"
                  : "Email reports"}
            </DialogTitle>
            <DialogDescription>{DESCRIPTIONS[targetType]}</DialogDescription>
          </DialogHeader>

          {editing ? (
            <form onSubmit={handleSave} className="min-w-0">
              <DialogBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="report-frequency"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Frequency
                  </Label>
                  <Select
                    value={frequency}
                    onValueChange={(value: Frequency) => setFrequency(value)}
                  >
                    <SelectTrigger
                      id="report-frequency"
                      className="h-9 border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCIES).map(([value, item]) => (
                        <SelectItem key={value} value={value} className="text-[13px]">
                          {item.title}
                          <span className="text-neutral-400 dark:text-muted-foreground">
                            {" "}
                            &middot; {item.detail}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="report-recipients"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Send to
                  </Label>
                  <Textarea
                    id="report-recipients"
                    name="recipients"
                    value={recipients}
                    onChange={(event) => setRecipients(event.target.value)}
                    placeholder={"client@example.com\nteam@example.com"}
                    rows={4}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!fieldError}
                    aria-describedby="report-recipients-help"
                    className={cn(
                      "resize-none border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card max-sm:text-base",
                      fieldError && "border-red-300 focus-visible:ring-red-300",
                    )}
                  />
                  {fieldError ? (
                    <p id="report-recipients-help" className="text-[12px] text-red-500">
                      {fieldError}
                    </p>
                  ) : (
                    <p
                      id="report-recipients-help"
                      className="text-[12px] text-neutral-500 dark:text-neutral-400"
                    >
                      Up to 5 addresses, one per line or separated by commas. Every report has an
                      unsubscribe link.
                    </p>
                  )}
                  {unsubscribedInForm.length > 0 && (
                    <p className="break-all text-[12px] text-amber-700 dark:text-amber-400">
                      {unsubscribedInForm.join(", ")}{" "}
                      {unsubscribedInForm.length === 1 ? "has" : "have"} unsubscribed and won&apos;t
                      get this report.
                    </p>
                  )}
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                  className="h-9 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
                >
                  {editing === "new"
                    ? create.isLoading
                      ? "Creating..."
                      : "Create report"
                    : update.isLoading
                      ? "Saving..."
                      : "Save"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              {/* min-w-0: the dialog is a grid, so long recipient lists would widen it instead of truncating */}
              <DialogBody className="min-w-0 space-y-3">
                {list.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-[60px] w-full rounded-lg" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : list.isError ? (
                  <p className="text-[13px] text-red-600 dark:text-red-400">
                    {list.error.message || "Couldn't load reports."}
                  </p>
                ) : data ? (
                  <>
                    {/* Free: upgrade prompt, plus any schedules left from a paid plan */}
                    {isFree && (
                      <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center dark:border-border">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
                          <IconMail
                            size={22}
                            stroke={1.5}
                            className="text-neutral-400 dark:text-muted-foreground"
                          />
                        </div>
                        <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
                          Email reports are on Pro
                        </p>
                        <p className="mt-1 max-w-xs text-[13px] text-neutral-500 dark:text-neutral-400">
                          Send clients and teammates a weekly or monthly summary automatically. Pro
                          includes 3 reports, Ultra unlimited.
                        </p>
                        <UpgradeCta
                          requiredPlan="pro"
                          source={UPGRADE_SOURCE}
                          promo={upgradeOffer}
                          className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]"
                        >
                          Upgrade to Pro
                        </UpgradeCta>
                      </div>
                    )}
                    {data.reports.length === 0 && !isFree ? (
                      <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500 dark:border-border dark:text-neutral-400">
                        No reports yet. Create one to email these stats every week or month.
                      </div>
                    ) : data.reports.length > 0 ? (
                      <ul className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 dark:divide-border dark:border-border">
                        {data.reports.map((report) => {
                          const off = report.recipients.filter((email) =>
                            report.unsubscribed.includes(email),
                          ).length;
                          return (
                            <li key={report.id} className="flex items-center gap-3 px-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-900 dark:text-foreground">
                                  <span className="min-w-0 truncate">
                                    {FREQUENCIES[report.frequency].title}
                                    <span className="font-normal text-neutral-400 dark:text-muted-foreground">
                                      {" "}
                                      &middot;{" "}
                                      {report.frequency === "weekly"
                                        ? "Mondays"
                                        : "1st of the month"}
                                    </span>
                                  </span>
                                  {report.paused && (
                                    <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                                      Paused
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">
                                  {report.recipients.join(", ")}
                                </p>
                                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                                  {report.lastSentAt
                                    ? `Last sent ${sentFmt.format(report.lastSentAt)}`
                                    : "Not sent yet"}
                                  {off > 0 && <> &middot; {off} unsubscribed</>}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                {!isFree && (
                                  <button
                                    type="button"
                                    aria-label="Edit report"
                                    onClick={() => openForm(report)}
                                    className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground"
                                  >
                                    <IconPencil size={15} stroke={1.5} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label="Delete report"
                                  onClick={() => setConfirmDelete(report)}
                                  className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-muted-foreground dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                >
                                  <IconTrash size={15} stroke={1.5} />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {hasPaused && (
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {isFree
                          ? "These reports are paused until you upgrade. Delete any you no longer need."
                          : "Paused reports are over your plan's limit. They resume when you upgrade or delete others."}
                      </p>
                    )}
                  </>
                ) : null}

                {data && data.limit !== null && data.limit > 0 && (
                  <p className="text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
                    {data.used.toLocaleString()} of {data.limit.toLocaleString()} reports used on
                    your plan.
                    {atLimit && (
                      <>
                        {" "}
                        <UpgradeCta
                          requiredPlan="ultra"
                          source={UPGRADE_SOURCE}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Upgrade to Ultra
                        </UpgradeCta>{" "}
                        for unlimited reports.
                      </>
                    )}
                  </p>
                )}
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="h-9 text-[13px]"
                >
                  Done
                </Button>
                {data && !isFree && (
                  <Button
                    type="button"
                    onClick={() => openForm("new")}
                    disabled={atLimit}
                    className="h-9 gap-1.5 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
                  >
                    <IconPlus size={14} stroke={2} />
                    New report
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Delete this report?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              {confirmDelete
                ? `${FREQUENCIES[confirmDelete.frequency].title} reports to ${confirmDelete.recipients.length} ${confirmDelete.recipients.length === 1 ? "address" : "addresses"} stop straight away.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 text-[13px] hover:bg-neutral-50 dark:border-border dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate({ id: confirmDelete.id })}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700"
            >
              Delete report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
