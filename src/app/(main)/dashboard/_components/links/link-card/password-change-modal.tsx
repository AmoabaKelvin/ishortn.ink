import { useState } from "react";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

type ChangePasswordModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  id: number;
  hasPassword: boolean;
};

const getComponentMessages = (hasPassword: boolean) => {
  return {
    title: hasPassword ? "Change Password" : "Set Password",
    description: hasPassword
      ? "Enter a new password for this link"
      : "Protect this link with a password",
    buttonText: hasPassword ? "Update" : "Set Password",
    inputPlaceholder: hasPassword ? "New password" : "Enter password",
    loading: hasPassword ? "Changing password..." : "Setting password...",
    loadingSuccess: hasPassword ? "Password changed successfully" : "Password set successfully",
    loadingError: hasPassword ? "Failed to change password" : "Failed to set password",
  };
};

export function ChangeLinkPasswordModal({
  open,
  setOpen,
  id,
  hasPassword,
}: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const changePasswordMutation = api.link.changeLinkPassword.useMutation();
  const componentMessages = getComponentMessages(hasPassword);

  // Closing (Cancel, Escape, outside click) discards what was typed.
  const handleOpenChange = (next: boolean) => {
    if (!next) setNewPassword("");
    setOpen(next);
  };

  const handlePasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPassword || changePasswordMutation.isLoading) return;

    const save = async () => {
      await changePasswordMutation.mutateAsync({ id, password: newPassword });
      // Revalidate after the write lands, or the card keeps its old label.
      await revalidateHomepage();
      trackEvent(POSTHOG_EVENTS.LINK_PASSWORD_CHANGED);
      handleOpenChange(false);
    };

    toast.promise(save(), {
      loading: componentMessages.loading,
      success: componentMessages.loadingSuccess,
      error: (error: Error) => error.message || componentMessages.loadingError,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handlePasswordChange}>
          <DialogHeader>
            <DialogTitle>{componentMessages.title}</DialogTitle>
            <DialogDescription>{componentMessages.description}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={componentMessages.inputPlaceholder}
                className="h-10"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newPassword || changePasswordMutation.isLoading}
              className="h-9"
            >
              {changePasswordMutation.isLoading ? "Saving..." : componentMessages.buttonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
