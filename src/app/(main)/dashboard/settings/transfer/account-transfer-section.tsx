"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Send,
  Undo2,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

interface AccountTransferSectionProps {
  isScheduledForDeletion: boolean;
  deletedAt: Date | null;
}

export function AccountTransferSection({
  isScheduledForDeletion,
  deletedAt,
}: AccountTransferSectionProps) {
  const router = useRouter();
  const [targetEmail, setTargetEmail] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const utils = api.useUtils();

  const {
    data: pendingTransfer,
    isLoading: isPendingLoading,
  } = api.accountTransfer.getPending.useQuery();

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

  const restoreMutation = api.accountTransfer.restore.useMutation({
    onSuccess: () => {
      utils.accountTransfer.getAccountStatus.invalidate();
      router.refresh();
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

  const handleRestore = async () => {
    await restoreMutation.mutateAsync();
  };

  const isLoading =
    validateMutation.isLoading ||
    initiateMutation.isLoading ||
    isPendingLoading;

  // Show restore option if account is scheduled for deletion
  if (isScheduledForDeletion && deletedAt) {
    const deletionDate = new Date(deletedAt);
    deletionDate.setDate(deletionDate.getDate() + 30);
    const daysRemaining = Math.ceil(
      (deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-900">
                Account Scheduled for Deletion
              </CardTitle>
              <CardDescription className="text-red-700/80">
                {daysRemaining > 0
                  ? `${daysRemaining} days remaining until permanent deletion`
                  : "Deletion imminent"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-red-500 shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-red-900">
                  Scheduled deletion: {deletionDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-red-700/80">
                  After this date, your account and all remaining data will be
                  permanently deleted. If you transferred your resources to another
                  account, restoring may result in duplicate data.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleRestore}
            disabled={restoreMutation.isLoading}
            className="border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            {restoreMutation.isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            Cancel Deletion & Restore Account
          </Button>
          {restoreMutation.error && (
            <p className="text-sm text-red-600">
              {restoreMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Transfer Account</CardTitle>
              <CardDescription>
                Transfer all your resources to another iShortn account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Transfer Section */}
          {pendingTransfer && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 shrink-0">
                  <Send className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-amber-900">
                        Transfer Pending
                      </p>
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                        Awaiting Approval
                      </Badge>
                    </div>
                    <p className="text-sm text-amber-800/80">
                      Transfer to <strong>{pendingTransfer.targetEmail}</strong> is
                      waiting for approval
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-amber-700/70">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires: {new Date(pendingTransfer.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelMutation.isLoading}
                    className="border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
                  >
                    {cancelMutation.isLoading && (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    )}
                    Cancel Transfer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Form */}
          {!pendingTransfer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetEmail">Recipient Email Address</Label>
                <div className="flex gap-3">
                  <Input
                    id="targetEmail"
                    type="email"
                    placeholder="recipient@example.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleValidate}
                    disabled={!targetEmail || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {validateMutation.isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Continue
                  </Button>
                </div>
              </div>

              {/* Validation Errors */}
              {validationResult && !validationResult.isValid && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Transfer Blocked</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2 mt-2">
                      {validationResult.errors.map(
                        (error: any, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-sm">• {error.message}</span>
                            {error.resourceType && (
                              <Badge variant="outline" className="text-xs">
                                {error.currentCount} / {error.limit} {error.resourceType}
                              </Badge>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Information Section */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                What will be transferred
              </h4>
              <div className="grid gap-2 text-sm text-muted-foreground pl-6">
                <p>• Links, custom domains, QR codes, UTM templates, QR presets</p>
                <p>• Site settings and preferences</p>
                <p>• Folders and tags (merged by name if they exist)</p>
                <p>• Analytics data (preserved automatically)</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                What will NOT be transferred
              </h4>
              <div className="grid gap-2 text-sm text-muted-foreground pl-6">
                <p>• API tokens (for security reasons)</p>
                <p>• Subscription (billing remains separate - cancel manually)</p>
                <p>• Team memberships (you&apos;ll remain in teams)</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Important:</strong> Once accepted, your account
                will be marked for deletion with a 30-day grace period. Your
                subscription will NOT be cancelled automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle>Confirm Account Transfer</DialogTitle>
                <DialogDescription>
                  Review the transfer details before proceeding
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Transferring to
                </p>
                <p className="text-lg font-semibold">{targetEmail}</p>
                <Badge variant="outline" className="mt-2 capitalize">
                  {validationResult.targetPlan} plan
                </Badge>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">Resources to transfer</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Links</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.links}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Domains</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.customDomains}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">QR Codes</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.qrCodes}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">UTM Templates</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.utmTemplates}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">QR Presets</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.qrPresets}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folders</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.folders}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tags</span>
                    <span className="font-medium tabular-nums">
                      {validationResult.resourceCounts.tags}
                    </span>
                  </div>
                </div>
              </div>

              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  This action cannot be undone once the recipient accepts.
                  Your account will be marked for deletion after transfer.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={initiateMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInitiate}
              disabled={initiateMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {initiateMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Transfer Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
