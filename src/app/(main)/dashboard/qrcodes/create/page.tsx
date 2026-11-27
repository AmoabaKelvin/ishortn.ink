"use client";

import {
  IconAddressBook,
  IconDeviceFloppy,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { TRPCClientError } from "@trpc/client";
import { useTransitionRouter } from "next-view-transitions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { requiredPlanForLimit } from "@/lib/billing/required-plan";
import { nextPlanFor } from "@/lib/billing/upgrade";
import { DEFAULT_PLATFORM_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { generateQRCode, defaultGeneratorState } from "@/lib/qr-generator";
import {
  encodeStaticQrPayload,
  STATIC_PAYLOAD_LABELS,
  staticPayloadSummary,
} from "@/lib/qr-generator/payload";
import { generateQRCodeSvg, hasRasterOnlyOptions, toLogoDataUri } from "@/lib/qr-generator/svg";
import { VCARD_LABEL, vcardSummary } from "@/lib/qr-generator/vcard";
import { cn } from "@/lib/utils";
import { INVALID_URL_MESSAGE, normalizeDestinationUrl } from "@/lib/utils/destination-url";
import { api } from "@/trpc/react";

import { PromoOfferSuffix, useUpgradeOffer } from "../../_components/upgrade-offer";
import { StaticPayloadFields } from "../_components/static-payload-fields";
import UpgradeText from "../_components/upgrade-text";
import { VCardFields } from "../_components/vcard-fields";
import {
  checkIfUserCanCreateMoreQRCodes,
  emptyStaticFormValues,
  emptyVCardFormValues,
  qrCodeFileName,
  qrCodeStyleFrom,
  saveBlob,
  saveSvg,
  staticPayloadFrom,
  SVG_EFFECTS_NOTE,
  validateStaticForm,
  validateVCardForm,
} from "../utils";
import QRAdvancedCustomization from "./_components/qr-advanced-customization";

import type { StaticFormValues, VCardFormValues } from "../utils";
import type { QRCodeGeneratorState } from "@/lib/qr-generator";
import type { StaticQrPayload, StaticQrPayloadType } from "@/lib/qr-generator/payload";
import type {
  QREffect,
  QRMarkerCenter,
  QRMarkerFrame,
  QRPixelStyle,
} from "@/lib/qr-generator/types";
import type { VCardPayload } from "@/lib/qr-generator/vcard";
import type { AppRouter } from "@/server/api/root";

type QrType = "link" | "vcard" | StaticQrPayloadType;

const QR_TYPES: { value: QrType; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "vcard", label: VCARD_LABEL },
  ...Object.entries(STATIC_PAYLOAD_LABELS).map(([value, label]) => ({
    // SAFETY: the keys of STATIC_PAYLOAD_LABELS are exactly the static payload types.
    value: value as StaticQrPayloadType,
    label,
  })),
];

function createErrorMessage(err: Error): string {
  if (err instanceof TRPCClientError) {
    // SAFETY: every error from this router carries the zodError field added by errorFormatter
    // in server/api/trpc.ts; for input errors `message` is the raw issue JSON.
    const zodError = (err as TRPCClientError<AppRouter>).data?.zodError;
    const fieldErrors: Record<string, string[] | undefined> = zodError?.fieldErrors ?? {};
    const issue = zodError?.formErrors[0] ?? Object.values(fieldErrors).flat()[0];
    if (issue) return issue;
  }
  return err.message || "Failed to create QR Code";
}

function QRCodeCreationPage() {
  const router = useTransitionRouter();
  const userSubDetails = api.subscriptions.get.useQuery().data;
  const upgradeOffer = useUpgradeOffer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(userSubDetails);

  const qrCodeCreateMutation = api.qrCode.create.useMutation();
  const qrCodeCreateStaticMutation = api.qrCode.createStatic.useMutation();
  const qrCodeCreateVCardMutation = api.qrCode.createVCard.useMutation();
  const qrCodeSaveImageMutation = api.qrCode.saveImage.useMutation();
  const qrCodeDeleteMutation = api.qrCode.delete.useMutation();

  const [qrCodeTitle, setQRCodeTitle] = useState<string>("");
  const [destinationUrl, setDestinationUrl] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>(DEFAULT_PLATFORM_DOMAIN);
  const [downloadFormat, setDownloadFormat] = useState<"png" | "svg">("png");
  const [qrType, setQrType] = useState<QrType>("link");
  const [staticValues, setStaticValues] = useState<StaticFormValues>(emptyStaticFormValues);
  const [vcardValues, setVCardValues] = useState<VCardFormValues>(emptyVCardFormValues);
  // Field errors show once a save has been tried, then update as the user types.
  const [showStaticErrors, setShowStaticErrors] = useState(false);
  const isStatic = qrType !== "link" && qrType !== "vcard";
  // Contact cards are hosted pages: Pro and Ultra (teams have Ultra features). Allowed while the
  // plan loads; the server enforces it.
  const canUseVCard =
    !userSubDetails || userSubDetails.plan !== "free" || userSubDetails.isTeamWorkspace;
  const vcardLocked = qrType === "vcard" && !canUseVCard;

  const customDomainsQuery = api.customDomain.list.useQuery();
  const userDomains = customDomainsQuery.data ?? [];

  const normalizedDestination = useMemo(
    () => normalizeDestinationUrl(destinationUrl),
    [destinationUrl],
  );
  const destinationLooksValid = normalizedDestination !== null;

  const staticResult = useMemo(
    () =>
      qrType === "link" || qrType === "vcard" ? null : validateStaticForm(qrType, staticValues),
    [qrType, staticValues],
  );
  const vcardResult = useMemo(() => validateVCardForm(vcardValues), [vcardValues]);
  // The preview encodes what's typed so far, even before every field is valid.
  const previewText = useMemo(() => {
    if (qrType === "link") return destinationUrl || "https://ishortn.ink";
    // The saved code encodes a new short link on this domain.
    if (qrType === "vcard") return `https://${selectedDomain}`;
    if (staticResult?.ok) return encodeStaticQrPayload(staticResult.payload);
    // SAFETY: an unvalidated payload has the right shape; encoding only reads its strings.
    return encodeStaticQrPayload(staticPayloadFrom(qrType, staticValues) as StaticQrPayload);
  }, [qrType, destinationUrl, selectedDomain, staticResult, staticValues]);
  const previewCaption =
    qrType === "link"
      ? destinationUrl || "Enter a destination URL above"
      : qrType === "vcard"
        ? vcardResult.ok
          ? vcardSummary(vcardResult.card)
          : "Fill in the contact details above"
        : staticResult?.ok
          ? staticPayloadSummary(staticResult.payload)
          : `Fill in the ${STATIC_PAYLOAD_LABELS[qrType]} details above`;

  // The ref blocks a second click before the disabled state has rendered.
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Advanced QR state using the new generator
  const [qrState, setQrState] = useState<QRCodeGeneratorState>(() => ({
    ...defaultGeneratorState(),
    scale: 10,
    margin: 2,
  }));

  // Preset state
  const [presetName, setPresetName] = useState("");
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  // Preset queries and mutations
  const utils = api.useUtils();
  const { data: presets, isLoading: isLoadingPresets } = api.qrCode.listPresets.useQuery();

  const createPresetMutation = api.qrCode.createPreset.useMutation({
    onSuccess: () => {
      toast.success("Preset saved successfully");
      setSavePresetDialogOpen(false);
      setPresetName("");
      utils.qrCode.listPresets.invalidate();
    },
    onError: () => {
      toast.error("Failed to save preset");
    },
  });

  const updatePresetMutation = api.qrCode.updatePreset.useMutation({
    onSuccess: () => {
      toast.success("Preset updated successfully");
      utils.qrCode.listPresets.invalidate();
    },
    onError: () => {
      toast.error("Failed to update preset");
    },
  });

  const deletePresetMutation = api.qrCode.deletePreset.useMutation({
    onSuccess: () => {
      toast.success("Preset deleted");
      if (selectedPresetId) setSelectedPresetId(null);
      utils.qrCode.listPresets.invalidate();
    },
    onError: () => {
      toast.error("Failed to delete preset");
    },
  });

  // Update QR state helper
  const updateQrState = useCallback((updates: Partial<QRCodeGeneratorState>) => {
    setQrState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load preset into current state
  const loadPreset = useCallback(
    (presetId: number) => {
      const preset = presets?.find((p) => p.id === presetId);
      if (!preset) return;

      setSelectedPresetId(presetId);
      // SAFETY: preset style columns are only written through qrPresetCreateInput /
      // qrPresetUpdateInput, which restrict them to the generator enums asserted here.
      setQrState((prev) => ({
        ...prev,
        pixelStyle: preset.pixelStyle as QRPixelStyle,
        markerFrame: preset.markerFrame as QRMarkerFrame,
        markerCenter: preset.markerCenter as QRMarkerCenter,
        darkColor: preset.darkColor,
        lightColor: preset.lightColor,
        effect: preset.effect as QREffect,
        effectCrystalizeRadius: preset.effectRadius,
        effectLiquidifyRadius: preset.effectRadius,
        marginNoise: preset.marginNoise,
        marginNoiseRate: parseFloat(preset.marginNoiseRate),
        logoImage: preset.logoImage ?? undefined,
        logoSize: Math.min(preset.logoSize ?? 25, 30),
        logoMargin: preset.logoMargin ?? 4,
        logoBorderRadius: preset.logoBorderRadius ?? 8,
      }));
    },
    [presets],
  );

  // Check if current state differs from the selected preset
  const hasPresetModifications = useMemo(() => {
    if (!selectedPresetId || !presets) return false;
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return false;

    return (
      qrState.pixelStyle !== preset.pixelStyle ||
      qrState.markerFrame !== preset.markerFrame ||
      qrState.markerCenter !== preset.markerCenter ||
      qrState.darkColor !== preset.darkColor ||
      qrState.lightColor !== preset.lightColor ||
      qrState.effect !== preset.effect ||
      qrState.effectCrystalizeRadius !== preset.effectRadius ||
      qrState.marginNoise !== preset.marginNoise ||
      qrState.marginNoiseRate !== parseFloat(preset.marginNoiseRate) ||
      qrState.logoImage !== (preset.logoImage ?? undefined) ||
      qrState.logoSize !== preset.logoSize ||
      qrState.logoMargin !== preset.logoMargin ||
      qrState.logoBorderRadius !== preset.logoBorderRadius
    );
  }, [selectedPresetId, presets, qrState]);

  // Save current style as preset
  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    createPresetMutation.mutate({
      name: presetName.trim(),
      pixelStyle: qrState.pixelStyle,
      markerFrame: qrState.markerFrame,
      markerCenter: qrState.markerCenter === "auto" ? "auto" : qrState.markerCenter,
      darkColor: qrState.darkColor,
      lightColor: qrState.lightColor,
      effect: qrState.effect,
      effectRadius: qrState.effectCrystalizeRadius,
      marginNoise: qrState.marginNoise,
      marginNoiseRate: String(qrState.marginNoiseRate),
      logoImage: qrState.logoImage,
      logoSize: qrState.logoSize,
      logoMargin: qrState.logoMargin,
      logoBorderRadius: qrState.logoBorderRadius,
    });
  };

  // Update the selected preset with current style
  const handleUpdatePreset = () => {
    if (!selectedPresetId) return;

    updatePresetMutation.mutate({
      id: selectedPresetId,
      pixelStyle: qrState.pixelStyle,
      markerFrame: qrState.markerFrame,
      markerCenter: qrState.markerCenter === "auto" ? "auto" : qrState.markerCenter,
      darkColor: qrState.darkColor,
      lightColor: qrState.lightColor,
      effect: qrState.effect,
      effectRadius: qrState.effectCrystalizeRadius,
      marginNoise: qrState.marginNoise,
      marginNoiseRate: String(qrState.marginNoiseRate),
      logoImage: qrState.logoImage,
      logoSize: qrState.logoSize,
      logoMargin: qrState.logoMargin,
      logoBorderRadius: qrState.logoBorderRadius,
    });
  };

  // Generate QR code with the new generator
  const regenerateQRCode = useCallback(async () => {
    if (!canvasRef.current) return;

    await generateQRCode(canvasRef.current, {
      ...qrState,
      text: previewText,
    });
  }, [qrState, previewText]);

  // Debounce the regeneration
  const [debouncedQrState] = useDebounce(qrState, 100);

  useEffect(() => {
    regenerateQRCode();
  }, [debouncedQrState, previewText, regenerateQRCode]);

  const handleSaveQRCode = async () => {
    if (savingRef.current) return;

    let staticPayload: StaticQrPayload | null = null;
    let card: VCardPayload | null = null;
    let linkContent = "";
    if (qrType === "vcard") {
      if (vcardLocked) return;
      if (!vcardResult.ok) {
        setShowStaticErrors(true);
        toast.error(vcardResult.message);
        return;
      }
      card = vcardResult.card;
    } else if (qrType === "link") {
      if (!destinationUrl.trim()) {
        toast.error("Please enter a destination URL");
        return;
      }
      if (!normalizedDestination) {
        toast.error(INVALID_URL_MESSAGE);
        return;
      }
      linkContent = normalizedDestination;
    } else {
      const result = validateStaticForm(qrType, staticValues);
      if (!result.ok) {
        setShowStaticErrors(true);
        toast.error(result.message);
        return;
      }
      staticPayload = result.payload;
    }

    trackEvent(POSTHOG_EVENTS.QR_CODE_CREATED, { type: qrType });
    savingRef.current = true;
    setIsSaving(true);

    const finalTitle = qrCodeTitle.trim() || "QR Code";

    const promise = (async () => {
      // Step 1: Create the QR record on the server: with a hidden tracking link for Link and vCard
      // codes, or with the encoded content for static ones.
      const fields = {
        title: finalTitle,
        patternStyle: qrState.pixelStyle,
        cornerStyle: qrState.markerFrame,
        selectedColor: qrState.darkColor,
      };
      const { id, text: qrText } = staticPayload
        ? await qrCodeCreateStaticMutation
            .mutateAsync({ ...fields, payload: staticPayload })
            .then(({ id, content }) => ({ id, text: content }))
        : card
          ? await qrCodeCreateVCardMutation
              .mutateAsync({ ...fields, card, domain: selectedDomain })
              .then(({ id, trackingUrl }) => ({ id, text: trackingUrl }))
          : await qrCodeCreateMutation
              .mutateAsync({ ...fields, content: linkContent, domain: selectedDomain })
              .then(({ id, trackingUrl }) => ({ id, text: trackingUrl }));

      try {
        // Step 2: Update the live preview so it matches the final output
        if (canvasRef.current) {
          await generateQRCode(canvasRef.current, {
            ...qrState,
            text: qrText,
          });
        }

        // Step 3: Generate the high-res QR image encoding the tracking URL for download
        const finalCanvas = document.createElement("canvas");
        await generateQRCode(finalCanvas, {
          ...qrState,
          text: qrText,
          scale: 20,
        });
        const qrCodeBase64 = finalCanvas.toDataURL("image/png", 1.0);

        // A logo picked from a preset is a stored URL, and uploads can be any image format; the
        // saved style takes PNG/JPEG data URIs. If it can't be read, the PNG above couldn't draw
        // it either.
        const logoImage = qrState.logoImage
          ? await toLogoDataUri(qrState.logoImage).catch(() => undefined)
          : undefined;
        const style = qrCodeStyleFrom(qrState, logoImage);

        // Step 4: Upload the correctly-encoded image, with the style the SVG download redraws
        await qrCodeSaveImageMutation.mutateAsync({ id, qrCodeBase64, style });

        if (downloadFormat === "svg") {
          const svg = generateQRCodeSvg({
            ...qrState,
            ecc: style.ecc,
            logoImage,
            text: qrText,
            scale: 20,
          });
          saveSvg(svg, qrCodeFileName(finalTitle, "svg"));
        } else {
          // Save from the in-memory canvas: the stored image is cross-origin, where `download`
          // is ignored and the browser would open it instead.
          const blob = await new Promise<Blob | null>((resolve) =>
            finalCanvas.toBlob(resolve, "image/png"),
          );
          if (blob) saveBlob(blob, qrCodeFileName(finalTitle));
        }
      } catch (err) {
        // Roll back the server record created in step 1 to avoid orphaned data
        await qrCodeDeleteMutation.mutateAsync({ id }).catch(() => {});
        throw err;
      }

      await revalidateRoute("/dashboard/qrcodes");
      router.push("/dashboard/qrcodes");
    })();

    // Stay disabled after success: the page is navigating away.
    promise.catch(() => {
      savingRef.current = false;
      setIsSaving(false);
    });

    const toastId = toast.loading("Creating QR Code...");
    promise.then(
      () => toast.success("QR Code created successfully", { id: toastId }),
      (err: Error) => {
        // The QR cap and the monthly link cap (each QR code needs a tracking link) are plan
        // limits: offer the upgrade instead of a dead-end error.
        if (
          err instanceof TRPCClientError &&
          err.data?.code === "FORBIDDEN" &&
          /upgrade/i.test(err.message)
        ) {
          toast.dismiss(toastId);
          notifyPlanLimit(
            err.message,
            "qr_create_limit",
            requiredPlanForLimit(err.message, userSubDetails?.plan),
            upgradeOffer,
          );
          return;
        }
        toast.error(createErrorMessage(err), { id: toastId });
      },
    );
  };

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      {/* Left Column - Configuration */}
      <div className="min-w-0 md:col-span-5">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Create a QR code
        </h2>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Configure content, style, and generate your QR code.
        </p>

        <div className="mt-5 space-y-5">
          {!canCreateMoreQRCodes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-500/10">
              <p className="text-[13px] text-amber-700 dark:text-amber-400">
                You've reached your plan's QR code limit.{" "}
                <UpgradeText
                  text="Upgrade"
                  source="qr_create_limit"
                  requiredPlan={nextPlanFor(userSubDetails?.plan ?? "free")}
                />{" "}
                to create more.
                <PromoOfferSuffix className="text-inherit dark:text-inherit" />
              </p>
            </div>
          )}

          {/* Setup Section */}
          <div className="space-y-4 rounded-lg border border-neutral-200 dark:border-border p-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label
                id="qr-type-label"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Type
              </Label>
              <Tabs
                value={qrType}
                onValueChange={(value) => {
                  const next = QR_TYPES.find((type) => type.value === value);
                  if (!next) return;
                  setQrType(next.value);
                  setShowStaticErrors(false);
                }}
              >
                <TabsList
                  aria-labelledby="qr-type-label"
                  className="grid h-auto w-full grid-cols-4 gap-0.5 bg-neutral-100 dark:bg-muted sm:grid-cols-7 md:grid-cols-4 xl:grid-cols-7"
                >
                  {QR_TYPES.map((type) => (
                    <TabsTrigger
                      key={type.value}
                      value={type.value}
                      className="h-7 px-2 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-900 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm dark:text-neutral-400 dark:hover:text-foreground dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground"
                    >
                      {type.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {isStatic && (
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Static code: scans aren't tracked and the content can't be changed after printing.
                  Use Link for a tracked, editable code.
                </p>
              )}
              {qrType === "vcard" && (
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Dynamic code: opens a contact page people can save to their phone. Scans are
                  tracked and the card can be edited after printing.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="qr-title"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Title
              </Label>
              <Input
                id="qr-title"
                placeholder="Give your QR code a name"
                value={qrCodeTitle}
                onChange={(e) => setQRCodeTitle(e.target.value)}
                className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
              />
            </div>

            {vcardLocked ? (
              <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center dark:border-border dark:bg-accent/50">
                <IconAddressBook
                  size={28}
                  stroke={1.5}
                  className="mx-auto text-neutral-300 dark:text-muted-foreground"
                />
                <p className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-400">
                  <UpgradeText text="Upgrade to Pro" source="qr_vcard" requiredPlan="pro" /> to
                  create vCard codes.
                  <PromoOfferSuffix />
                </p>
                <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Put an editable contact card on business cards and badges. Change a number or
                  email later without reprinting.
                </p>
              </div>
            ) : qrType === "vcard" ? (
              <VCardFields
                values={vcardValues}
                onChange={(patch) => setVCardValues((prev) => ({ ...prev, ...patch }))}
                errors={showStaticErrors && !vcardResult.ok ? vcardResult.fieldErrors : {}}
                idPrefix="qr-create-vcard"
              />
            ) : isStatic ? (
              <StaticPayloadFields
                type={qrType}
                values={staticValues}
                onChange={(patch) => setStaticValues((prev) => ({ ...prev, ...patch }))}
                errors={
                  showStaticErrors && staticResult && !staticResult.ok
                    ? staticResult.fieldErrors
                    : {}
                }
                idPrefix="qr-create"
              />
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Destination URL
                </Label>
                <Input
                  placeholder="https://example.com"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                />
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  The URL people will be redirected to when scanning the QR code
                </p>
              </div>
            )}

            {((qrType === "link" && destinationLooksValid) ||
              (qrType === "vcard" && !vcardLocked)) && (
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Link domain
                </Label>
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] text-neutral-700 dark:text-neutral-300">
                    <SelectValue placeholder={DEFAULT_PLATFORM_DOMAIN} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PLATFORM_DOMAINS.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {domain}
                        </SelectItem>
                      ))}
                      {userDomains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.domain!}>
                          {domain.domain}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Pick the domain shown when someone scans your QR code.
                </p>
              </div>
            )}
          </div>

          {/* Design Section */}
          <div className="rounded-lg border border-neutral-200 dark:border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
                  Design
                </p>
                <span className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  Customize appearance and effects
                </span>
              </div>
              {hasPresetModifications ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-border px-3 py-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
                  onClick={handleUpdatePreset}
                  disabled={updatePresetMutation.isLoading}
                >
                  <IconRefresh
                    size={14}
                    stroke={1.5}
                    className={cn(updatePresetMutation.isLoading && "animate-spin")}
                  />
                  {updatePresetMutation.isLoading ? "Updating..." : "Update Preset"}
                </button>
              ) : (
                <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-border px-3 py-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
                    >
                      <IconDeviceFloppy size={14} stroke={1.5} />
                      Save Preset
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                      <DialogTitle>Save Style Preset</DialogTitle>
                      <DialogDescription>
                        Save your current style settings for reuse
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="preset-name"
                          className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                        >
                          Preset Name
                        </Label>
                        <Input
                          id="preset-name"
                          placeholder="e.g., Brand Style, Marketing Campaign"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        />
                      </div>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setSavePresetDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSavePreset}
                        disabled={createPresetMutation.isLoading}
                        className="bg-blue-600 text-[13px] hover:bg-blue-700"
                      >
                        {createPresetMutation.isLoading ? "Saving..." : "Save Preset"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Presets */}
            <div className="mt-4 space-y-4">
              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-6">
                  <IconLoader2
                    size={16}
                    stroke={1.5}
                    className="animate-spin text-neutral-400 dark:text-muted-foreground"
                  />
                </div>
              ) : presets && presets.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-neutral-400 dark:text-muted-foreground">
                    Saved Presets
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedPresetId ? String(selectedPresetId) : undefined}
                      onValueChange={(value) => loadPreset(Number(value))}
                    >
                      <SelectTrigger className="h-9 flex-1 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] text-neutral-700 dark:text-neutral-300">
                        <SelectValue placeholder="Select a preset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {presets.map((preset) => (
                            <SelectItem key={preset.id} value={String(preset.id)}>
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {selectedPresetId !== null && (
                      <button
                        type="button"
                        aria-label="Delete selected preset"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 dark:border-border text-neutral-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-500/10"
                        onClick={() => deletePresetMutation.mutate({ id: selectedPresetId })}
                        disabled={deletePresetMutation.isLoading}
                      >
                        <IconTrash size={14} stroke={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                  No presets yet. Save your first style preset for quick reuse.
                </p>
              )}

              <div className="border-t border-neutral-100 dark:border-border/50" />

              <QRAdvancedCustomization
                pixelStyle={qrState.pixelStyle}
                setPixelStyle={(style) => updateQrState({ pixelStyle: style })}
                markerFrame={qrState.markerFrame}
                setMarkerFrame={(frame) => updateQrState({ markerFrame: frame })}
                markerCenter={qrState.markerCenter === "auto" ? "auto" : qrState.markerCenter}
                setMarkerCenter={(center) => updateQrState({ markerCenter: center })}
                darkColor={qrState.darkColor}
                setDarkColor={(color) => updateQrState({ darkColor: color })}
                lightColor={qrState.lightColor}
                setLightColor={(color) => updateQrState({ lightColor: color })}
                effect={qrState.effect}
                setEffect={(effect) => updateQrState({ effect })}
                effectRadius={qrState.effectCrystalizeRadius}
                setEffectRadius={(radius) =>
                  updateQrState({
                    effectCrystalizeRadius: radius,
                    effectLiquidifyRadius: radius,
                  })
                }
                marginNoise={qrState.marginNoise}
                setMarginNoise={(enabled) => updateQrState({ marginNoise: enabled })}
                marginNoiseRate={qrState.marginNoiseRate}
                setMarginNoiseRate={(rate) => updateQrState({ marginNoiseRate: rate })}
                logoImage={qrState.logoImage}
                setLogoImage={(image) => updateQrState({ logoImage: image })}
                logoSize={qrState.logoSize}
                setLogoSize={(size) => updateQrState({ logoSize: size })}
                logoMargin={qrState.logoMargin}
                setLogoMargin={(margin) => updateQrState({ logoMargin: margin })}
                logoBorderRadius={qrState.logoBorderRadius}
                setLogoBorderRadius={(radius) => updateQrState({ logoBorderRadius: radius })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden items-center justify-center md:flex">
        <div className="h-screen border-r border-neutral-200 dark:border-border" />
      </div>

      {/* Right Column - Preview */}
      <div className="mt-4 flex min-w-0 flex-col gap-4 md:col-span-5 md:mt-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Preview
          </h2>
          <p className="text-[13px] text-neutral-400 dark:text-muted-foreground">
            Live preview of your QR code
          </p>
        </div>

        <div className="sticky top-6 space-y-5">
          {/* QR Code Preview */}
          <div className="flex flex-col items-center rounded-lg border border-neutral-200 dark:border-border p-8">
            <div
              className="rounded-xl p-4 transition-all duration-300"
              style={{ backgroundColor: qrState.lightColor }}
            >
              <canvas
                ref={canvasRef}
                className="block"
                style={{
                  maxWidth: "240px",
                  width: "100%",
                  height: "auto",
                }}
              />
            </div>

            <div className="mt-4 w-full max-w-[280px]">
              <p className="text-center text-[12px] text-neutral-400 dark:text-muted-foreground truncate">
                {previewCaption}
              </p>
            </div>
          </div>

          {/* Download format */}
          <div className="space-y-1.5">
            <Label
              htmlFor="qr-download-format"
              className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
            >
              Download as
            </Label>
            <Select
              value={downloadFormat}
              onValueChange={(value) => setDownloadFormat(value === "svg" ? "svg" : "png")}
            >
              <SelectTrigger
                id="qr-download-format"
                className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] text-neutral-700 dark:text-neutral-300"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG, high resolution</SelectItem>
                <SelectItem value="svg">SVG, vector for print and engraving</SelectItem>
              </SelectContent>
            </Select>
            {downloadFormat === "svg" && hasRasterOnlyOptions(qrState) && (
              <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                {SVG_EFFECTS_NOTE}
              </p>
            )}
          </div>

          {/* Generate Button */}
          <Button
            className="w-full bg-blue-600 text-[13px] hover:bg-blue-700"
            onClick={handleSaveQRCode}
            disabled={!canCreateMoreQRCodes || vcardLocked || isSaving}
          >
            {isSaving ? (
              <IconLoader2 size={16} stroke={2} className="mr-2 animate-spin" />
            ) : (
              <IconDownload size={16} stroke={2} className="mr-2" />
            )}
            {isSaving ? "Generating..." : "Generate & Download"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default QRCodeCreationPage;
