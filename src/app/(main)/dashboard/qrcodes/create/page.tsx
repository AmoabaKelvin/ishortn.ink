"use client";

import {
  IconDeviceFloppy,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useTransitionRouter } from "next-view-transitions";
import posthog from "posthog-js";
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
import { DEFAULT_PLATFORM_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { generateQRCode, defaultGeneratorState } from "@/lib/qr-generator";
import type { QRCodeGeneratorState } from "@/lib/qr-generator";
import type {
  QREffect,
  QRMarkerInnerShape,
  QRMarkerShape,
  QRPixelStyle,
} from "@/lib/qr-generator/types";

import { checkIfUserCanCreateMoreQRCodes } from "../utils";

import QRAdvancedCustomization from "./_components/qr-advanced-customization";

function QRCodeCreationPage() {
  const router = useTransitionRouter();
  const userSubDetails = api.subscriptions.get.useQuery().data;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canCreateMoreQRCodes =
    checkIfUserCanCreateMoreQRCodes(userSubDetails);

  const qrCodeCreateMutation = api.qrCode.create.useMutation();
  const qrCodeSaveImageMutation = api.qrCode.saveImage.useMutation();
  const qrCodeDeleteMutation = api.qrCode.delete.useMutation();

  const [qrCodeTitle, setQRCodeTitle] = useState<string>("");
  const [destinationUrl, setDestinationUrl] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>(
    DEFAULT_PLATFORM_DOMAIN,
  );

  const customDomainsQuery = api.customDomain.list.useQuery();
  const userDomains = customDomainsQuery.data ?? [];

  const destinationLooksValid = useMemo(() => {
    const value = destinationUrl.trim();
    if (!value || !value.includes(".")) return false;
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      return url.hostname.includes(".");
    } catch {
      return false;
    }
  }, [destinationUrl]);

  // Advanced QR state using the new generator
  const [qrState, setQrState] = useState<QRCodeGeneratorState>(() => ({
    ...defaultGeneratorState(),
    scale: 10,
    margin: 2,
  }));

  // Preset state
  const [presetName, setPresetName] = useState("");
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(
    null,
  );

  // Preset queries and mutations
  const utils = api.useUtils();
  const { data: presets, isLoading: isLoadingPresets } =
    api.qrCode.listPresets.useQuery();

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
  const updateQrState = useCallback(
    (updates: Partial<QRCodeGeneratorState>) => {
      setQrState((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  // Load preset into current state
  const loadPreset = useCallback(
    (presetId: number) => {
      const preset = presets?.find((p) => p.id === presetId);
      if (!preset) return;

      setSelectedPresetId(presetId);
      setQrState((prev) => ({
        ...prev,
        pixelStyle: preset.pixelStyle as QRPixelStyle,
        markerShape: preset.markerShape as QRMarkerShape,
        markerInnerShape: preset.markerInnerShape as QRMarkerInnerShape,
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
      qrState.markerShape !== preset.markerShape ||
      qrState.markerInnerShape !== preset.markerInnerShape ||
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
      markerShape: qrState.markerShape,
      markerInnerShape:
        qrState.markerInnerShape === "auto"
          ? "auto"
          : qrState.markerInnerShape,
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
      markerShape: qrState.markerShape,
      markerInnerShape:
        qrState.markerInnerShape === "auto"
          ? "auto"
          : qrState.markerInnerShape,
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
      text: destinationUrl || "https://ishortn.ink",
    });
  }, [qrState, destinationUrl]);

  // Debounce the regeneration
  const [debouncedQrState] = useDebounce(qrState, 100);

  useEffect(() => {
    regenerateQRCode();
  }, [debouncedQrState, destinationUrl, regenerateQRCode]);

  const handleSaveQRCode = async () => {
    posthog.capture("qr_code_created");

    if (!destinationUrl) {
      toast.error("Please enter a destination URL");
      return;
    }

    const finalTitle = qrCodeTitle || "QR Code";

    const promise = (async () => {
      // Step 1: Create the hidden short link and QR record on the server
      const { trackingUrl, id } = await qrCodeCreateMutation.mutateAsync({
        title: finalTitle,
        content: destinationUrl,
        patternStyle: qrState.pixelStyle as string,
        cornerStyle: qrState.markerShape as string,
        selectedColor: qrState.darkColor,
        domain: selectedDomain,
      });

      try {
        // Step 2: Update the live preview so it matches the final output
        if (canvasRef.current) {
          await generateQRCode(canvasRef.current, {
            ...qrState,
            text: trackingUrl,
          });
        }

        // Step 3: Generate the high-res QR image encoding the tracking URL for download
        const finalCanvas = document.createElement("canvas");
        await generateQRCode(finalCanvas, {
          ...qrState,
          text: trackingUrl,
          scale: 20,
        });
        const qrCodeBase64 = finalCanvas.toDataURL("image/png", 1.0);

        // Step 4: Upload the correctly-encoded image
        const imageUrl = await qrCodeSaveImageMutation.mutateAsync({
          id,
          qrCodeBase64,
        });

        // Trigger download
        const link = document.createElement("a");
        link.href = imageUrl!;
        link.download = "qrcode.png";
        link.click();
      } catch (err) {
        // Roll back the server record created in step 1 to avoid orphaned data
        await qrCodeDeleteMutation.mutateAsync({ id }).catch(() => {});
        throw err;
      }

      await revalidateRoute("/dashboard/qrcodes");
      router.push("/dashboard/qrcodes");
    })();

    toast.promise(promise, {
      loading: "Creating QR Code...",
      success: "QR Code created successfully",
      error: (err: unknown) =>
        err instanceof Error && err.message
          ? err.message
          : "Failed to create QR Code",
    });
  };

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      {/* Left Column - Configuration */}
      <div className="min-w-0 md:col-span-5">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Create a QR code
        </h2>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
          Configure content, style, and generate your QR code.
        </p>

        <div className="mt-5 space-y-5">
          {/* Setup Section */}
          <div className="space-y-4 rounded-lg border border-neutral-200 dark:border-border p-4">
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
              <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                The URL people will be redirected to when scanning the QR code
              </p>
            </div>

            {destinationLooksValid && (
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
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
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
                <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
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
                    className={cn(
                      updatePresetMutation.isLoading && "animate-spin",
                    )}
                  />
                  {updatePresetMutation.isLoading
                    ? "Updating..."
                    : "Update Preset"}
                </button>
              ) : (
                <Dialog
                  open={savePresetDialogOpen}
                  onOpenChange={setSavePresetDialogOpen}
                >
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
                      <Button
                        variant="ghost"
                        onClick={() => setSavePresetDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSavePreset}
                        disabled={createPresetMutation.isLoading}
                        className="bg-blue-600 text-[13px] hover:bg-blue-700"
                      >
                        {createPresetMutation.isLoading
                          ? "Saving..."
                          : "Save Preset"}
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
                    className="animate-spin text-neutral-400 dark:text-neutral-500"
                  />
                </div>
              ) : presets && presets.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
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
                        onClick={() =>
                          deletePresetMutation.mutate({ id: selectedPresetId })
                        }
                        disabled={deletePresetMutation.isLoading}
                      >
                        <IconTrash size={14} stroke={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  No presets yet. Save your first style preset for quick reuse.
                </p>
              )}

              <div className="border-t border-neutral-100 dark:border-border/50" />

              <QRAdvancedCustomization
                pixelStyle={qrState.pixelStyle}
                setPixelStyle={(style) =>
                  updateQrState({ pixelStyle: style })
                }
                markerShape={qrState.markerShape}
                setMarkerShape={(shape) =>
                  updateQrState({ markerShape: shape })
                }
                markerInnerShape={
                  qrState.markerInnerShape === "auto"
                    ? "auto"
                    : qrState.markerInnerShape
                }
                setMarkerInnerShape={(shape) =>
                  updateQrState({ markerInnerShape: shape })
                }
                darkColor={qrState.darkColor}
                setDarkColor={(color) =>
                  updateQrState({ darkColor: color })
                }
                lightColor={qrState.lightColor}
                setLightColor={(color) =>
                  updateQrState({ lightColor: color })
                }
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
                setMarginNoise={(enabled) =>
                  updateQrState({ marginNoise: enabled })
                }
                marginNoiseRate={qrState.marginNoiseRate}
                setMarginNoiseRate={(rate) =>
                  updateQrState({ marginNoiseRate: rate })
                }
                logoImage={qrState.logoImage}
                setLogoImage={(image) =>
                  updateQrState({ logoImage: image })
                }
                logoSize={qrState.logoSize}
                setLogoSize={(size) => updateQrState({ logoSize: size })}
                logoMargin={qrState.logoMargin}
                setLogoMargin={(margin) =>
                  updateQrState({ logoMargin: margin })
                }
                logoBorderRadius={qrState.logoBorderRadius}
                setLogoBorderRadius={(radius) =>
                  updateQrState({ logoBorderRadius: radius })
                }
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
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
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
              <p className="text-center text-[12px] text-neutral-400 dark:text-neutral-500 truncate">
                {destinationUrl || "Enter a destination URL above"}
              </p>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full bg-blue-600 text-[13px] hover:bg-blue-700"
            onClick={handleSaveQRCode}
            disabled={!canCreateMoreQRCodes}
          >
            <IconDownload size={16} stroke={1.5} className="mr-2" />
            Generate & Download
          </Button>

          {!canCreateMoreQRCodes && (
            <p className="text-center text-[12px] text-neutral-400 dark:text-neutral-500">
              You've reached your QR code limit. Upgrade to create more.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default QRCodeCreationPage;
