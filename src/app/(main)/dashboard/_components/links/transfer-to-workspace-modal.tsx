"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  Loader2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

interface TransferToWorkspaceModalProps {
  linkIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TransferToWorkspaceModal({
  linkIds,
  open,
  onOpenChange,
  onSuccess,
}: TransferToWorkspaceModalProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [step, setStep] = useState<"select" | "confirm">("select");

  const utils = api.useUtils();

  const {
    data: workspaces,
    isLoading: loadingWorkspaces,
    error: workspacesError,
  } = api.link.getAvailableWorkspaces.useQuery(undefined, {
    enabled: open,
  });

  const validateMutation = api.link.validateTransfer.useMutation();

  const transferMutation = api.link.transferToWorkspace.useMutation({
    onSuccess: async (result) => {
      toast.success(
        `${result.transferredCount} ${
          result.transferredCount === 1 ? "link" : "links"
        } transferred`
      );
      await utils.link.list.invalidate();
      await utils.folder.list.invalidate();
      await revalidateHomepage();
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setStep("select");
    setSelectedWorkspaceId("");
    validateMutation.reset();
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (!selectedWorkspaceId) return;

    const selectedWorkspace = workspaces?.find(
      (w) => w.id === selectedWorkspaceId
    );
    if (!selectedWorkspace) return;

    const payload = selectedWorkspace.type === "team"
      ? { linkIds, targetWorkspaceType: "team" as const, targetTeamId: selectedWorkspace.teamId! }
      : { linkIds, targetWorkspaceType: "personal" as const };

    validateMutation.mutate(payload, {
      onSuccess: (result) => {
        if (result.isValid) {
          setStep("confirm");
        } else {
          toast.error(result.errors[0]?.message ?? "Transfer validation failed");
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleTransfer = () => {
    const selectedWorkspace = workspaces?.find(
      (w) => w.id === selectedWorkspaceId
    );
    if (!selectedWorkspace) return;

    const payload = selectedWorkspace.type === "team"
      ? { linkIds, targetWorkspaceType: "team" as const, targetTeamId: selectedWorkspace.teamId! }
      : { linkIds, targetWorkspaceType: "personal" as const };

    transferMutation.mutate(payload);
  };

  const handleBack = () => {
    setStep("select");
    validateMutation.reset();
  };

  const selectedWorkspace = workspaces?.find(
    (w) => w.id === selectedWorkspaceId
  );
  const availableWorkspaces = workspaces?.filter((w) => !w.isCurrent) ?? [];
  const validation = validateMutation.data;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <AnimatePresence mode="wait">
          {step === "select" ? (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader>
                <DialogTitle>
                  Transfer {linkIds.length === 1 ? "link" : `${linkIds.length} links`}
                </DialogTitle>
                <DialogDescription>
                  Select destination workspace
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
                {loadingWorkspaces ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-lg bg-muted animate-pulse"
                      />
                    ))}
                  </div>
                ) : workspacesError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-3">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-sm font-medium">Failed to load workspaces</p>
                    <p className="text-xs text-muted-foreground mt-1">Please try again</p>
                  </div>
                ) : availableWorkspaces.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No workspaces available</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a team or join another workspace</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px] -mx-1 px-1">
                    <div className="space-y-1.5">
                      {availableWorkspaces.map((workspace, index) => (
                        <motion.button
                          key={workspace.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: index * 0.03 }}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all duration-150",
                            "border",
                            selectedWorkspaceId === workspace.id
                              ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                              : "border-transparent hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedWorkspaceId(workspace.id)}
                        >
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                            selectedWorkspaceId === workspace.id
                              ? "bg-foreground/10"
                              : "bg-muted"
                          )}>
                            {workspace.type === "personal" ? (
                              <User className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate text-sm">
                                {workspace.name}
                              </span>
                              {workspace.type === "team" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize font-medium">
                                  {workspace.role}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {workspace.linkCount} links · {workspace.plan}
                            </p>
                          </div>
                          <div className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all",
                            selectedWorkspaceId === workspace.id
                              ? "border-foreground bg-foreground"
                              : "border-muted-foreground/30"
                          )}>
                            {selectedWorkspaceId === workspace.id && (
                              <Check className="h-2.5 w-2.5 text-background" />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DialogBody>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={
                    !selectedWorkspaceId ||
                    validateMutation.isLoading ||
                    availableWorkspaces.length === 0
                  }
                  className="h-9"
                >
                  {validateMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader className="flex-row items-center gap-3 space-y-0">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={transferMutation.isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <DialogTitle>Confirm transfer</DialogTitle>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4">
                {/* Visual transfer representation */}
                <div className="flex items-center justify-center gap-4 py-6">
                  {/* Source */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-2">
                      <span className="text-xl font-bold">{linkIds.length}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{linkIds.length === 1 ? "link" : "links"}</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center px-2">
                    <motion.div
                      initial={{ x: -5, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  </div>

                  {/* Destination */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-2">
                      {selectedWorkspace?.type === "personal" ? (
                        <User className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-xs font-medium max-w-[100px] truncate text-center">
                      {selectedWorkspace?.name}
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {validation?.warnings && validation.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Note</p>
                        <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                          {validation.warnings.map((warning, i) => (
                            <li key={i}>{warning.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info bullets */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Analytics data will be preserved</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Short URLs will continue to work</span>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={transferMutation.isLoading}
                  className="h-9"
                >
                  Back
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={transferMutation.isLoading}
                  className="h-9"
                >
                  {transferMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    "Transfer"
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
