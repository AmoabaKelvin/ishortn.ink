"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function AccountTransferSection() {
  const [targetEmail, setTargetEmail] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const utils = api.useUtils();

  const { data: pendingTransfer, isLoading: isPendingLoading } =
    api.accountTransfer.getPending.useQuery();

  const validateMutation = api.accountTransfer.validate.useMutation();

  const initiateMutation = api.accountTransfer.initiate.useMutation({
    onSuccess: () => {
      utils.accountTransfer.getPending.invalidate();
      setShowConfirmDialog(false);
      setTargetEmail("");
      setValidationResult(null);
    },
  });

  const cancelMutation = api.accountTransfer.cancel.useMutation({
    onSuccess: () => {
      utils.accountTransfer.getPending.invalidate();
    },
  });

  const handleValidate = async () => {
    if (!targetEmail) return;
    try {
      const result = await validateMutation.mutateAsync({ targetEmail });
      setValidationResult(result);
      if (result.isValid) {
        setShowConfirmDialog(true);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleInitiate = async () => {
    await initiateMutation.mutateAsync({ targetEmail });
  };

  const handleCancel = async () => {
    if (!pendingTransfer) return;
    await cancelMutation.mutateAsync({ transferId: pendingTransfer.id });
  };

  const isLoading =
    validateMutation.isLoading || initiateMutation.isLoading || isPendingLoading;

  return (
    <>
      <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
        <div className="space-y-5">
          {/* Pending Transfer */}
          {pendingTransfer && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 p-4">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-200">
                Transfer pending
              </p>
              <p className="mt-1 text-[12px] text-amber-700/80 dark:text-amber-300/80">
                Waiting for <strong>{pendingTransfer.targetEmail}</strong> to
                accept. Expires{" "}
                {new Date(pendingTransfer.expiresAt).toLocaleDateString()}.
              </p>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelMutation.isLoading}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-border px-3 py-1.5 text-[12px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 disabled:opacity-50"
              >
                {cancelMutation.isLoading && (
                  <IconLoader2 size={13} stroke={1.5} className="animate-spin" />
                )}
                Cancel Transfer
              </button>
            </div>
          )}

          {/* Transfer Form */}
          {!pendingTransfer && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="targetEmail"
                  className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Recipient email
                </label>
                <div className="flex gap-2">
                  <Input
                    id="targetEmail"
                    type="email"
                    placeholder="recipient@example.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-9 flex-1 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!targetEmail || isLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {validateMutation.isLoading && (
                      <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                    )}
                    Continue
                  </button>
                </div>
              </div>

              {/* Validation Errors */}
              {validationResult && !validationResult.isValid && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10 p-3">
                  {validationResult.errors.map(
                    (error: any, index: number) => (
                      <p key={index} className="text-[12px] text-red-700 dark:text-red-400">
                        {error.message}
                        {error.resourceType &&
                          ` (${error.currentCount}/${error.limit} ${error.resourceType})`}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="space-y-2 text-[12px] text-neutral-400 dark:text-neutral-500">
            <p>
              <strong className="text-neutral-600 dark:text-neutral-400">Transferred:</strong> Links,
              custom domains, QR codes, UTM templates, folders, tags, and
              analytics data.
            </p>
            <p>
              <strong className="text-neutral-600 dark:text-neutral-400">Not transferred:</strong> API
              tokens, subscription, and team memberships.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md rounded-xl border-neutral-200 dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Confirm Transfer
            </DialogTitle>
            <DialogDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
              You&apos;re about to transfer your resources to{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{targetEmail}</span>
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <DialogBody className="space-y-3">
              <div className="rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
                  <span className="text-neutral-400 dark:text-neutral-500">Links</span>
                  <span className="text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                    {validationResult.resourceCounts.links}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500">Domains</span>
                  <span className="text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                    {validationResult.resourceCounts.customDomains}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500">QR Codes</span>
                  <span className="text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                    {validationResult.resourceCounts.qrCodes}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500">Folders</span>
                  <span className="text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                    {validationResult.resourceCounts.folders}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500">Tags</span>
                  <span className="text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                    {validationResult.resourceCounts.tags}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                This action cannot be undone once accepted.
              </p>
            </DialogBody>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowConfirmDialog(false)}
              disabled={initiateMutation.isLoading}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInitiate}
              disabled={initiateMutation.isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {initiateMutation.isLoading ? (
                <>
                  <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Request"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
