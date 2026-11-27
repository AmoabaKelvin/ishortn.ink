"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

import { validateVCardForm, vcardFormValuesFrom } from "../utils";
import { VCardFields } from "./vcard-fields";

import type { VCardFormValues } from "../utils";
import type { VCardPayload } from "@/lib/qr-generator/vcard";
import type { RouterOutputs } from "@/trpc/shared";

type EditVCardQRCodeBodyProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  card: VCardPayload;
  onClose: () => void;
};

export function EditVCardQRCodeBody({ qr, card, onClose }: EditVCardQRCodeBodyProps) {
  const [title, setTitle] = useState(qr.title ?? "");
  const [values, setValues] = useState<VCardFormValues>(() => vcardFormValuesFrom(card));
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateMutation = api.qrCode.updateVCard.useMutation();
  const result = useMemo(() => validateVCardForm(values), [values]);

  const handleSave = () => {
    if (isSaving) return;
    if (!result.ok) {
      setShowErrors(true);
      toast.error(result.message);
      return;
    }

    setIsSaving(true);
    const promise = (async () => {
      await updateMutation.mutateAsync({
        id: qr.id,
        title: title.trim() || "QR Code",
        card: result.card,
      });
      await revalidateRoute("/dashboard/qrcodes");
      onClose();
    })().finally(() => setIsSaving(false));

    toast.promise(promise, {
      loading: "Updating contact card...",
      success: "Contact card updated. Printed codes already show the new details.",
      error: (err: Error) => err.message || "Failed to update contact card",
    });
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-6">
          <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
                  vCard code
                </p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  The code keeps its short link, so codes already printed open the updated card.
                </p>
              </div>
              {qr.link && (
                <a
                  href={qr.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md text-[12px] font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  View contact page
                  <IconExternalLink size={12} stroke={1.5} />
                </a>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="qr-edit-vcard-title"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Title
              </Label>
              <Input
                id="qr-edit-vcard-title"
                name="title"
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
              />
            </div>

            <VCardFields
              values={values}
              onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
              errors={showErrors && !result.ok ? result.fieldErrors : {}}
              idPrefix={`qr-edit-${qr.id}`}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-border dark:bg-accent/50">
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 border-neutral-200 text-[13px] hover:bg-neutral-50 dark:border-border dark:hover:bg-accent/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </>
  );
}
