"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
      <Card>
        <CardHeader>
          <CardTitle>Transfer Account</CardTitle>
          <CardDescription>
            Move all your links, domains, QR codes, and other resources to
            another iShortn account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Transfer */}
          {pendingTransfer && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Transfer pending
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/80">
                Waiting for <strong>{pendingTransfer.targetEmail}</strong> to
                accept. Expires{" "}
                {new Date(pendingTransfer.expiresAt).toLocaleDateString()}.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelMutation.isLoading}
                className="mt-3"
              >
                {cancelMutation.isLoading && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                Cancel Transfer
              </Button>
            </div>
          )}

          {/* Transfer Form */}
          {!pendingTransfer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetEmail">Recipient email</Label>
                <div className="flex gap-2">
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
                  >
                    {validateMutation.isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Continue
                  </Button>
                </div>
              </div>

              {/* Validation Errors */}
              {validationResult && !validationResult.isValid && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {validationResult.errors.map(
                      (error: any, index: number) => (
                        <p key={index} className="text-sm">
                          {error.message}
                          {error.resourceType &&
                            ` (${error.currentCount}/${error.limit} ${error.resourceType})`}
                        </p>
                      )
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Info */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Transferred:</strong> Links,
              custom domains, QR codes, UTM templates, folders, tags, and
              analytics data.
            </p>
            <p>
              <strong className="text-foreground">Not transferred:</strong> API
              tokens, subscription, and team memberships.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogDescription>
              Transfer all resources to{" "}
              <strong className="text-foreground">{targetEmail}</strong>
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4">
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Resources
                </p>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Links</span>
                  <span className="text-right tabular-nums">
                    {validationResult.resourceCounts.links}
                  </span>
                  <span className="text-muted-foreground">Domains</span>
                  <span className="text-right tabular-nums">
                    {validationResult.resourceCounts.customDomains}
                  </span>
                  <span className="text-muted-foreground">QR Codes</span>
                  <span className="text-right tabular-nums">
                    {validationResult.resourceCounts.qrCodes}
                  </span>
                  <span className="text-muted-foreground">Folders</span>
                  <span className="text-right tabular-nums">
                    {validationResult.resourceCounts.folders}
                  </span>
                  <span className="text-muted-foreground">Tags</span>
                  <span className="text-right tabular-nums">
                    {validationResult.resourceCounts.tags}
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This action cannot be undone once accepted.
              </p>
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
            >
              {initiateMutation.isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
