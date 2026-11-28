"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateQRCode } from "@/lib/qr-generator";
import { encodeStaticQrPayload, STATIC_PAYLOAD_LABELS } from "@/lib/qr-generator/payload";
import { toDataUri } from "@/lib/qr-generator/svg";
import { api } from "@/trpc/react";

import { staticFormValuesFrom, validateStaticForm } from "../utils";
import { StaticPayloadFields } from "./static-payload-fields";

import type { StaticFormValues } from "../utils";
import type { QRCodeGeneratorState } from "@/lib/qr-generator";
import type { StaticQrPayloadType } from "@/lib/qr-generator/payload";
import type { RouterOutputs } from "@/trpc/shared";

type EditStaticQRCodeBodyProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  type: StaticQrPayloadType;
  /** The code's saved style, drawn with the edited content. */
  state: QRCodeGeneratorState;
  onClose: () => void;
};

export function EditStaticQRCodeBody({ qr, type, state, onClose }: EditStaticQRCodeBodyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(qr.title ?? "");
  const [values, setValues] = useState<StaticFormValues>(() => staticFormValuesFrom(qr));
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateMutation = api.qrCode.updateStatic.useMutation();

  const result = useMemo(() => validateStaticForm(type, values), [type, values]);
  const [debouncedResult] = useDebounce(result, 150);

  // The stored logo is a URL; a canvas only exports when the logo is a data URI.
  const logoPromise = useMemo(
    () =>
      state.logoImage
        ? toDataUri(state.logoImage).catch(() => undefined)
        : Promise.resolve(undefined),
    [state.logoImage],
  );

  useEffect(() => {
    if (!debouncedResult.ok || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const text = encodeStaticQrPayload(debouncedResult.payload);
    void logoPromise.then((logoImage) =>
      generateQRCode(canvas, { ...state, logoImage, text, scale: 10 }),
    );
  }, [debouncedResult, logoPromise, state]);

  const handleSave = () => {
    if (isSaving) return;
    if (!result.ok) {
      setShowErrors(true);
      toast.error(result.message);
      return;
    }
    const { payload } = result;

    setIsSaving(true);
    const promise = (async () => {
      const canvas = document.createElement("canvas");
      await generateQRCode(canvas, {
        ...state,
        logoImage: await logoPromise,
        text: encodeStaticQrPayload(payload),
        scale: 20,
      });
      await updateMutation.mutateAsync({
        id: qr.id,
        title: title.trim() || "QR Code",
        payload,
        qrCodeBase64: canvas.toDataURL("image/png", 1.0),
      });
      await revalidateRoute("/dashboard/qrcodes");
      onClose();
    })().finally(() => setIsSaving(false));

    toast.promise(promise, {
      loading: "Updating QR code...",
      success: "QR code updated. Download it again to print the new version.",
      error: (err: Error) => err.message || "Failed to update QR code",
    });
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-6">
          <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-border">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-lg border border-neutral-100 bg-white p-1.5 dark:border-border/50 dark:bg-card">
                <canvas ref={canvasRef} aria-hidden className="block h-20 w-20" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
                  {STATIC_PAYLOAD_LABELS[type]} code
                </p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Static code: scans aren't tracked. Codes already printed keep their old content;
                  download and print it again after saving.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="qr-edit-title"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Title
              </Label>
              <Input
                id="qr-edit-title"
                name="title"
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
              />
            </div>

            <StaticPayloadFields
              type={type}
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
