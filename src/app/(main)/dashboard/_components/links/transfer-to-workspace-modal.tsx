"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      <DialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl gap-0">
        <AnimatePresence mode="wait">
          {step === "select" ? (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Transfer {linkIds.length === 1 ? "link" : `${linkIds.length} links`}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Select destination workspace
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {loadingWorkspaces ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-xl bg-gray-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : workspacesError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-3">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">Failed to load workspaces</p>
                    <p className="text-xs text-gray-500 mt-1">Please try again</p>
                  </div>
                ) : availableWorkspaces.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">No workspaces available</p>
                    <p className="text-xs text-gray-500 mt-1">Create a team or join another workspace</p>
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
                            "w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-150",
                            "border",
                            selectedWorkspaceId === workspace.id
                              ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                              : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                          )}
                          onClick={() => setSelectedWorkspaceId(workspace.id)}
                        >
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                            selectedWorkspaceId === workspace.id
                              ? workspace.type === "personal" ? "bg-blue-100" : "bg-blue-100"
                              : workspace.type === "personal" ? "bg-gray-100" : "bg-gray-100"
                          )}>
                            {workspace.type === "personal" ? (
                              <User className={cn(
                                "h-5 w-5 transition-colors",
                                selectedWorkspaceId === workspace.id ? "text-blue-600" : "text-gray-500"
                              )} />
                            ) : (
                              <Building2 className={cn(
                                "h-5 w-5 transition-colors",
                                selectedWorkspaceId === workspace.id ? "text-blue-600" : "text-gray-500"
                              )} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium truncate transition-colors",
                                selectedWorkspaceId === workspace.id ? "text-blue-900" : "text-gray-900"
                              )}>
                                {workspace.name}
                              </span>
                              {workspace.type === "team" && (
                                <Badge className={cn(
                                  "text-[10px] px-1.5 py-0 h-4 capitalize border-0 font-medium",
                                  workspace.role === "owner"
                                    ? "bg-amber-100 text-amber-700"
                                    : workspace.role === "admin"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600"
                                )}>
                                  {workspace.role}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {workspace.linkCount} links · {workspace.plan}
                            </p>
                          </div>
                          <div className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                            selectedWorkspaceId === workspace.id
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300 bg-white"
                          )}>
                            {selectedWorkspaceId === workspace.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.15 }}
                              >
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100"
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
                  className="flex-1 rounded-xl bg-blue-500 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {validateMutation.isLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Checking...
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header with back button */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={transferMutation.isLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <DialogTitle className="text-lg font-semibold text-gray-900">
                      Confirm transfer
                    </DialogTitle>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 space-y-4">
                {/* Visual transfer representation */}
                <div className="flex items-center justify-center gap-4 py-6">
                  {/* Source */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mb-2">
                      <span className="text-xl font-bold text-gray-700">{linkIds.length}</span>
                    </div>
                    <span className="text-xs text-gray-500">{linkIds.length === 1 ? "link" : "links"}</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center px-2">
                    <motion.div
                      initial={{ x: -5, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <ArrowRight className="h-5 w-5 text-blue-500" />
                    </motion.div>
                  </div>

                  {/* Destination */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl mb-2",
                      selectedWorkspace?.type === "personal" ? "bg-blue-100" : "bg-blue-100"
                    )}>
                      {selectedWorkspace?.type === "personal" ? (
                        <User className="h-6 w-6 text-blue-600" />
                      ) : (
                        <Building2 className="h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-900 max-w-[100px] truncate text-center">
                      {selectedWorkspace?.name}
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {validation?.warnings && validation.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-900">Note</p>
                        <ul className="text-xs text-amber-800 space-y-1">
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
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span>Analytics data will be preserved</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span>Short URLs will continue to work</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={transferMutation.isLoading}
                  className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100"
                >
                  Back
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={transferMutation.isLoading}
                  className="flex-1 rounded-xl bg-blue-500 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {transferMutation.isLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Transferring...
                    </span>
                  ) : (
                    "Transfer"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
