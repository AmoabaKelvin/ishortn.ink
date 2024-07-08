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

type ChangePasswordModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;

  alias: string;
};

export function ChangeLinkPasswordModal({ open, setOpen, alias }: ChangePasswordModalProps) {
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

  const handlePasswordChange = async () => {
    if (!newPassword) return;

    toast.promise(changePasswordMutation.mutateAsync({ alias, password: newPassword }), {
      loading: "Changing password...",
      success: "Password changed successfully",
      error: "Failed to change password",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={`sm:max-w-[425px] ${satoshi.className}`}>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Change the password for the link.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <input
            type="password"
            name="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="w-[85%] rounded-md border border-gray-300 p-2 md:w-96"
          />
          <Button className="mt-4 w-full" onClick={handlePasswordChange}>
            Change Password
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
