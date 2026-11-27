import { IconFileSpreadsheet, IconFileZip, IconQrcode, IconUpload } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { buildQrZip } from "@/app/(main)/dashboard/qrcodes/qr-export";
import {
  qrZipBaseNames,
  savedQrCodeSvgState,
  saveBlob,
} from "@/app/(main)/dashboard/qrcodes/utils";
import { revalidateHomepage, revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradeCta } from "@/components/upgrade-cta";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { nextPlanFor } from "@/lib/billing/upgrade";
import { clientLogger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";
import { isBitlyExport, readCsvHeaders } from "@/lib/utils/link-csv-headers";
import { api } from "@/trpc/react";

import type { Plan } from "@/lib/billing/plans";
import type { RouterOutputs } from "@/trpc/shared";

type ImportResult = RouterOutputs["link"]["bulkUpload"];

type BulkLinkUploadDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  plan: Plan;
  /** QR codes per import: 0 when bulk QR isn't on the plan, null when unlimited. */
  bulkQrLimit: number | null;
};

type ImportError = { message: string; upgrade: boolean };

const DEFAULT_STYLE = "default";
// Enough of the file to hold its header row.
const HEADER_SAMPLE_BYTES = 4096;

export function BulkLinkUploadDialog({
  open,
  setOpen,
  plan,
  bulkQrLimit,
}: BulkLinkUploadDialogProps) {
  const proMembership = plan !== "free";
  const [file, setFile] = useState<File | null>(null);
  const [keepBitlyCodes, setKeepBitlyCodes] = useState(false);
  const [createQrCodes, setCreateQrCodes] = useState(false);
  const [qrStyle, setQrStyle] = useState(DEFAULT_STYLE);
  const [result, setResult] = useState<ImportResult | null>(null);
  // Shown inline rather than as a toast: on narrow screens a toast covers the dialog's buttons.
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const selectedFile = useRef<File | null>(null);

  const utils = api.useUtils();
  const presets = api.qrCode.listPresets.useQuery(undefined, {
    enabled: open && proMembership && createQrCodes,
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles) => {
      const dropped = acceptedFiles[0] ?? null;
      selectedFile.current = dropped;
      setFile(dropped);
      setResult(null);
      setImportError(null);
      if (!dropped) return;
      // Bitly's codes only matter for a Bitly export, so the option follows the file.
      void dropped
        .slice(0, HEADER_SAMPLE_BYTES)
        .text()
        .then((start) => {
          if (selectedFile.current === dropped) {
            setKeepBitlyCodes(isBitlyExport(readCsvHeaders(start)));
          }
        })
        .catch(() => setKeepBitlyCodes(false));
    },
    onDropRejected: () => {
      setImportError({
        message: "Unsupported file type. Please upload a CSV file.",
        upgrade: false,
      });
    },
  });

  const uploadMutation = api.link.bulkUpload.useMutation({
    onSuccess: async (result) => {
      setFile(null);
      if (result.created > 0) {
        await utils.link.list.invalidate();
        await revalidateHomepage();
      }
      if (result.qrCodes.length > 0) await revalidateRoute("/dashboard/qrcodes");
      if (result.failed === 0 && result.notices.length === 0 && result.qrCodes.length === 0) {
        toast.success(result.message);
        handleOpenChange(false);
        return;
      }
      // Keep the dialog open so the per-row reasons, notices and QR code ZIP stay reachable;
      // the summary shows in the dialog instead of a toast.
      setResult(result);
    },
    onError: (error) => {
      // Plan limits (links per month, QR codes per import) get the upgrade prompt below.
      setImportError({ message: error.message, upgrade: error.data?.code === "FORBIDDEN" });
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    setImportError(null);
    const csv = await file.text();
    uploadMutation.mutate({
      csv,
      keepBitlyCodes,
      qrCodes: createQrCodes
        ? { presetId: qrStyle === DEFAULT_STYLE ? null : Number(qrStyle) }
        : undefined,
    });
  };

  const handleDownloadZip = async () => {
    if (!result?.qrStyle || result.qrCodes.length === 0) return;
    const style = result.qrStyle;
    const names = qrZipBaseNames(result.qrCodes);
    const items = result.qrCodes.map((code, index) => ({
      name: names[index]!,
      state: savedQrCodeSvgState({ style, color: style.darkColor, link: code }),
    }));

    setIsZipping(true);
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "zip", count: items.length });
    try {
      saveBlob(await buildQrZip(items), "ishortn-qr-codes.zip");
    } catch (error) {
      clientLogger.warn(
        { err: error instanceof Error ? error : String(error) },
        "bulk QR code ZIP failed",
      );
      setImportError({ message: "Couldn't create the ZIP. Please try again.", upgrade: false });
    } finally {
      setIsZipping(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      selectedFile.current = null;
      setFile(null);
      setKeepBitlyCodes(false);
      setResult(null);
      setImportError(null);
    }
  };

  const qrLimitText =
    bulkQrLimit === null
      ? "No limit on the number of codes."
      : `Up to ${bulkQrLimit.toLocaleString()} codes per import on your plan.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Import links from CSV</DialogTitle>
          <DialogDescription>
            {proMembership
              ? "Upload a CSV with a url column (alias, domain, title and note optional), or a link export from Bitly as-is. Up to 1,000 links per file."
              : "Importing links from a CSV file is available on paid plans."}
          </DialogDescription>
        </DialogHeader>

        {proMembership && (
          <DialogBody className="space-y-4">
            <div
              {...getRootProps({ role: "button", "aria-label": "Choose a CSV file to import" })}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                isDragActive
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                  : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-border dark:bg-accent/50 dark:hover:bg-accent",
              )}
            >
              <input {...getInputProps()} />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-card">
                {file ? (
                  <IconFileSpreadsheet
                    size={18}
                    stroke={1.5}
                    className="text-neutral-500 dark:text-neutral-400"
                  />
                ) : (
                  <IconUpload
                    size={18}
                    stroke={1.5}
                    className="text-neutral-400 dark:text-muted-foreground"
                  />
                )}
              </div>
              {file ? (
                <>
                  <p className="mt-3 max-w-full truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
                    {file.name}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
                    Ready to import. Click to choose a different file.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    {isDragActive ? "Drop the file to select it" : "Drop a CSV file here"}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
                    or click to choose one
                  </p>
                </>
              )}
            </div>

            <label
              htmlFor="keep-bitly-codes"
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-3 dark:border-border"
            >
              <Checkbox
                id="keep-bitly-codes"
                checked={keepBitlyCodes}
                onCheckedChange={(value) => setKeepBitlyCodes(value === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Also keep Bitly&apos;s original codes (like go.example.com/3XCetqn) working
                </span>
                <span className="mt-0.5 block text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Applies to Bitly exports. Each code counts as one link.
                </span>
              </span>
            </label>

            <div className="rounded-lg border border-neutral-200 p-3 dark:border-border">
              <label htmlFor="create-qr-codes" className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  id="create-qr-codes"
                  checked={createQrCodes}
                  onCheckedChange={(value) => {
                    setCreateQrCodes(value === true);
                    setImportError(null);
                  }}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Also create QR codes
                  </span>
                  <span className="mt-0.5 block text-[12px] text-neutral-400 dark:text-muted-foreground">
                    One per row for its short link, downloadable as a ZIP of SVG and PNG files named
                    by alias. {qrLimitText}
                  </span>
                </span>
              </label>

              {createQrCodes && (
                <div className="mt-3 space-y-1.5 sm:pl-[26px]">
                  <Label
                    htmlFor="bulk-qr-style"
                    className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    QR style
                  </Label>
                  <Select value={qrStyle} onValueChange={setQrStyle} disabled={presets.isLoading}>
                    <SelectTrigger
                      id="bulk-qr-style"
                      className="h-9 border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card"
                    >
                      {presets.isLoading ? (
                        <span className="text-neutral-400 dark:text-muted-foreground">
                          Loading styles...
                        </span>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_STYLE} className="text-[13px]">
                        Default style
                      </SelectItem>
                      {presets.data?.map((preset) => (
                        <SelectItem
                          key={preset.id}
                          value={String(preset.id)}
                          className="text-[13px]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className="h-3 w-3 shrink-0 rounded-full border border-neutral-200 dark:border-border"
                              style={{ backgroundColor: preset.darkColor }}
                            />
                            <span className="truncate">{preset.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {presets.isError ? (
                    <p className="text-[12px] text-red-500">
                      Couldn&apos;t load your saved styles. The default style will be used.
                    </p>
                  ) : (
                    presets.data?.length === 0 && (
                      <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                        Styles you save while creating a QR code show up here.
                      </p>
                    )
                  )}
                </div>
              )}
            </div>

            {importError && !importError.upgrade && (
              <p role="alert" className="break-words text-[12px] text-red-500">
                {importError.message}
              </p>
            )}

            {importError?.upgrade && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-[12px] text-amber-700 dark:text-amber-400">
                  {importError.message}
                </p>
                <UpgradeCta
                  requiredPlan={nextPlanFor(plan)}
                  source={createQrCodes ? "bulk_qr" : "bulk_import"}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Upgrade
                </UpgradeCta>
              </div>
            )}

            {result && result.qrCodes.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-border sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
                    <IconQrcode
                      size={16}
                      stroke={1.5}
                      className="text-neutral-500 dark:text-neutral-400"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium tabular-nums text-neutral-900 dark:text-foreground">
                      {result.qrCodes.length.toLocaleString()}{" "}
                      {result.qrCodes.length === 1 ? "QR code" : "QR codes"} ready
                    </p>
                    <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                      Also saved in{" "}
                      <Link
                        href="/dashboard/qrcodes"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        QR Codes
                      </Link>
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="h-9 shrink-0 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
                >
                  <IconFileZip size={15} stroke={1.5} />
                  {isZipping ? "Preparing ZIP..." : "Download ZIP"}
                </Button>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <output className="block text-[13px] text-neutral-700 dark:text-neutral-300">
                  {result.message}
                </output>

                {result.domainNotices.length > 0 && (
                  <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                    {result.domainNotices.map((notice) => (
                      <li key={notice} className="break-words">
                        {notice}
                      </li>
                    ))}
                  </ul>
                )}

                {result.failures.length > 0 && (
                  <ImportRowList
                    title={`${result.failures.length.toLocaleString()} ${result.failures.length === 1 ? "row was" : "rows were"} not imported`}
                    items={result.failures.map((failure) => ({
                      row: failure.row,
                      text: failure.reason,
                    }))}
                    textClassName="text-red-600 dark:text-red-400"
                  />
                )}

                {result.notices.length > 0 && (
                  <ImportRowList
                    title={`${result.notices.length.toLocaleString()} ${result.notices.length === 1 ? "row" : "rows"} imported with changes`}
                    items={result.notices.map((notice) => ({
                      row: notice.row,
                      text: notice.message,
                    }))}
                    textClassName="text-neutral-700 dark:text-neutral-300"
                  />
                )}
              </div>
            )}
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="h-9 text-[13px]"
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {proMembership ? (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {uploadMutation.isLoading ? "Importing..." : "Import links"}
            </Button>
          ) : (
            <Button asChild className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700">
              <UpgradeCta requiredPlan="pro" source="bulk_import">
                Upgrade
              </UpgradeCta>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ImportRowListProps = {
  title: string;
  items: { row: number; text: string }[];
  textClassName: string;
};

function ImportRowList({ title, items, textClassName }: ImportRowListProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border">
      <p className="border-b border-neutral-100 px-3 py-2 text-[13px] font-medium text-neutral-900 dark:border-border/50 dark:text-foreground">
        {title}
      </p>
      <ul className="max-h-48 divide-y divide-neutral-300/60 overflow-y-auto dark:divide-border">
        {items.map((item, index) => (
          <li key={`${item.row}-${index}`} className="flex gap-2 px-3 py-2 text-[12px]">
            <span className="shrink-0 tabular-nums text-neutral-400 dark:text-muted-foreground">
              Row {item.row.toLocaleString()}
            </span>
            <span className={cn("min-w-0 break-words", textClassName)}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
