"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const MAX_REPLY_LENGTH = 5000;

type ReplyFeedbackDialogProps = {
  feedback: { id: number; message: string; email: string } | null;
  onOpenChange: (open: boolean) => void;
  onReplied: () => void;
};

export function ReplyFeedbackDialog({
  feedback,
  onOpenChange,
  onReplied,
}: ReplyFeedbackDialogProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const replyMutation = api.feedback.reply.useMutation({
    onSuccess: () => {
      toast.success("Reply sent and feedback resolved");
      setMessage("");
      onOpenChange(false);
      onReplied();
    },
    onError: (err) => toast.error(err.message),
  });

  const close = (open: boolean) => {
    if (replyMutation.isLoading) return;
    if (!open) {
      setMessage("");
      setError(null);
    }
    onOpenChange(open);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!feedback) return;
    if (!message.trim()) {
      setError("Write a reply first");
      return;
    }
    setError(null);
    replyMutation.mutate({ id: feedback.id, message });
  };

  return (
    <Dialog open={feedback !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Reply to feedback</DialogTitle>
          <DialogDescription className="break-all">
            Emailed to {feedback?.email}. Replies go to the support inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <div className="max-h-32 overflow-y-auto rounded-lg bg-neutral-50 px-3 py-2 dark:bg-accent/50">
              <p className="text-[12px] whitespace-pre-wrap break-words text-neutral-500 dark:text-neutral-400">
                {feedback?.message}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="feedback-reply"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Reply
              </Label>
              <Textarea
                id="feedback-reply"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_REPLY_LENGTH}
                rows={6}
                placeholder="Write your reply..."
                aria-invalid={error !== null}
                className={cn(
                  "resize-none border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card",
                  error && "border-red-300 focus-visible:ring-red-300",
                )}
              />
              {error && <p className="text-[12px] text-red-500">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => close(false)}
              disabled={replyMutation.isLoading}
              className="h-9 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={replyMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {replyMutation.isLoading ? "Sending..." : "Send and resolve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
