import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../actions/revalidate-homepage";

type ChangePasswordModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;

  alias: string;
  hasPassword: boolean;
};

const getComponentMessages = (hasPassword: boolean) => {
  // Return the appropriate messages based on whether the link has a password or not
  return {
    title: hasPassword ? "Change Password" : "Set Password",
    description: hasPassword ? "Change the password for the link." : "Set a password for the link.",
    buttonText: hasPassword ? "Update Password" : "Set Password",
    inputPlaceholder: hasPassword ? "New Password" : "Password",

    loading: hasPassword ? "Changing password..." : "Setting password...",
    loadingSuccess: hasPassword ? "Password changed successfully" : "Password set successfully",
    loadingError: hasPassword ? "Failed to change password" : "Failed to set password",
  };
};

export function ChangeLinkPasswordModal({
  open,
  setOpen,
  alias,
  hasPassword,
}: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const changePasswordMutation = api.link.changeLinkPassword.useMutation({
    onSuccess: () => {
      setOpen(false);
      setNewPassword("");
      posthog.capture("link_password_changed");
    },
    onError: () => {
      setNewPassword("");
    },
  });
  const componentMessages = getComponentMessages(hasPassword);

  const handlePasswordChange = async () => {
    if (!newPassword) return;

    toast.promise(changePasswordMutation.mutateAsync({ alias, password: newPassword }), {
      loading: componentMessages.loading,
      success: componentMessages.loadingSuccess,
      error: componentMessages.loadingError,
    });

    await revalidateHomepage();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={`sm:max-w-[425px] ${satoshi.className}`}>
        <DialogHeader>
          <DialogTitle>{componentMessages.title}</DialogTitle>
          <DialogDescription>{componentMessages.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <input
            type="password"
            name="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={componentMessages.inputPlaceholder}
            className="w-[85%] rounded-md border border-gray-300 p-2 md:w-96"
          />
          <Button
            className="mt-4 w-full"
            onClick={handlePasswordChange}
            disabled={!newPassword || changePasswordMutation.isLoading}
          >
            {componentMessages.buttonText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
