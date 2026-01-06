"use client";

import { Check, ChevronsUpDown, Download, Info, Loader2, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { generateQRCode, defaultGeneratorState } from "@/lib/qr-generator";
import type { QRCodeGeneratorState } from "@/lib/qr-generator";
import type { QREffect, QRMarkerInnerShape, QRMarkerShape, QRPixelStyle } from "@/lib/qr-generator/types";

import { checkIfUserCanCreateMoreQRCodes } from "../utils";

import QRCodeContent from "./_components/qr-content";
import QRAdvancedCustomization from "./_components/qr-advanced-customization";

function QRCodeCreationPage() {
  const router = useTransitionRouter();
  const userSubDetails = api.subscriptions.get.useQuery().data;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(userSubDetails);

  const qrCodeCreateMutation = api.qrCode.create.useMutation({
    onSuccess: async (data) => {
      toast.success("QR Code created successfully");
      const link = document.createElement("a");
      link.href = data!;
      link.download = "qrcode.png";
      link.click();

      await revalidateRoute("/dashboard/qrcodes");
      router.push("/dashboard/qrcodes");
    },
  });

  const [qrCodeTitle, setQRCodeTitle] = useState<string>("");
  const [enteredContent, setEnteredContent] = useState<string>("");
  const [isStandalone, setIsStandalone] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{
    id: number;
    alias: string;
    domain: string;
    url: string;
  } | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

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

  const { data: linksData, isLoading: isLoadingLinks } = api.link.list.useQuery(
    {
      page: 1,
      pageSize: 50,
      search: debouncedSearch,
    },
    {
      enabled: !isStandalone,
    }
  );

  // Update QR state helper
  const updateQrState = useCallback((updates: Partial<QRCodeGeneratorState>) => {
    setQrState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load preset into current state
  const loadPreset = useCallback((presetId: number) => {
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
      // Logo settings (with defaults for older presets)
      logoImage: preset.logoImage ?? undefined,
      logoSize: preset.logoSize ?? 25,
      logoMargin: preset.logoMargin ?? 4,
      logoBorderRadius: preset.logoBorderRadius ?? 8,
    }));
  }, [presets]);

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
      // Logo settings
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
      markerInnerShape: qrState.markerInnerShape === "auto" ? "auto" : qrState.markerInnerShape,
      darkColor: qrState.darkColor,
      lightColor: qrState.lightColor,
      effect: qrState.effect,
      effectRadius: qrState.effectCrystalizeRadius,
      marginNoise: qrState.marginNoise,
      marginNoiseRate: String(qrState.marginNoiseRate),
      // Logo settings
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
      markerInnerShape: qrState.markerInnerShape === "auto" ? "auto" : qrState.markerInnerShape,
      darkColor: qrState.darkColor,
      lightColor: qrState.lightColor,
      effect: qrState.effect,
      effectRadius: qrState.effectCrystalizeRadius,
      marginNoise: qrState.marginNoise,
      marginNoiseRate: String(qrState.marginNoiseRate),
      // Logo settings
      logoImage: qrState.logoImage,
      logoSize: qrState.logoSize,
      logoMargin: qrState.logoMargin,
      logoBorderRadius: qrState.logoBorderRadius,
    });
  };

  // Get current content for QR code
  const getCurrentContent = useCallback(() => {
    if (isStandalone && enteredContent) {
      return enteredContent;
    }
    if (!isStandalone && selectedLink) {
      return `https://${selectedLink.domain}/${selectedLink.alias}`;
    }
    return "https://ishortn.ink";
  }, [isStandalone, enteredContent, selectedLink]);

  // Generate QR code with the new generator
  const regenerateQRCode = useCallback(async () => {
    if (!canvasRef.current) return;

    const content = getCurrentContent();
    await generateQRCode(canvasRef.current, {
      ...qrState,
      text: content,
    });
  }, [qrState, getCurrentContent]);

  // Debounce the regeneration
  const [debouncedQrState] = useDebounce(qrState, 100);

  useEffect(() => {
    regenerateQRCode();
  }, [debouncedQrState, enteredContent, selectedLink, isStandalone, regenerateQRCode]);

  const handleSaveQRCode = async () => {
    posthog.capture("qr_code_created");

    let finalContent = "";
    let wasShortened = false;
    let finalTitle = qrCodeTitle;

    // Determine content based on mode
    if (isStandalone) {
      if (!enteredContent) {
        toast.error("Please enter content for the QR Code");
        return;
      }
      finalContent = enteredContent;
      wasShortened = false;
      finalTitle = finalTitle || "Standalone QR Code";
    } else {
      if (!selectedLink) {
        toast.error("Please select a link");
        return;
      }
      finalContent = `https://${selectedLink.domain}/${selectedLink.alias}`;
      wasShortened = true;
      finalTitle = finalTitle || selectedLink.alias;
    }

    // Generate final high-quality QR code
    const finalCanvas = document.createElement("canvas");
    await generateQRCode(finalCanvas, {
      ...qrState,
      text: finalContent,
      scale: 20, // High quality for download
    });

    const url = finalCanvas.toDataURL("image/png", 1.0);

    const qrCodeData = {
      wasShortened,
      title: finalTitle,
      content: finalContent,
      patternStyle: qrState.pixelStyle as string,
      cornerStyle: qrState.markerShape as string,
      selectedColor: qrState.darkColor,
      qrCodeBase64: url,
    };

    toast.promise(qrCodeCreateMutation.mutateAsync(qrCodeData), {
      loading: "Creating QR Code...",
      success: "QR Code created successfully",
      error: "Failed to create QR Code",
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Column - Configuration */}
      <div className="w-full lg:w-[60%] space-y-6">
        {/* Link Selection / Standalone Mode Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">QR Code Setup</CardTitle>
            <CardDescription>
              Configure the basic settings for your QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="qr-title" className="text-xs text-gray-600">Title</Label>
              <Input
                id="qr-title"
                placeholder="Give your QR code a memorable name"
                value={qrCodeTitle}
                onChange={(e) => setQRCodeTitle(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Standalone Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="standalone-mode" className="text-sm font-medium text-gray-900">
                  Standalone Mode
                </Label>
                <p className="text-xs text-gray-500">
                  Create without link tracking
                </p>
              </div>
              <Switch
                id="standalone-mode"
                checked={isStandalone}
                onCheckedChange={setIsStandalone}
              />
            </div>

            {isStandalone && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900">No Analytics</p>
                    <p className="text-xs text-blue-700">
                      Standalone QR codes encode content directly and won't track scans.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Link Selection */}
            {!isStandalone && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Linked URL</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full h-10 justify-between font-normal"
                    >
                      {selectedLink ? (
                        <span className="truncate">{selectedLink.domain}/{selectedLink.alias}</span>
                      ) : (
                        <span className="text-gray-500">Select a link...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search links..."
                        value={search}
                        onValueChange={setSearch}
                      />
                      <CommandList>
                        {isLoadingLinks && (
                          <div className="py-8 text-center">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                            <p className="mt-2 text-xs text-gray-500">Loading links...</p>
                          </div>
                        )}
                        {!isLoadingLinks && linksData?.links.length === 0 && (
                          <CommandEmpty>No links found.</CommandEmpty>
                        )}
                        {!isLoadingLinks &&
                          linksData?.links.map((link) => (
                            <CommandItem
                              key={link.id}
                              value={String(link.id)}
                              onSelect={() => {
                                setSelectedLink({
                                  id: link.id,
                                  alias: link.alias!,
                                  domain: link.domain,
                                  url: link.url!,
                                });
                                setOpenCombobox(false);
                              }}
                              className="py-3"
                            >
                              <Check
                                className={cn(
                                  "mr-3 h-4 w-4 text-blue-500",
                                  selectedLink?.id === link.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-medium text-gray-900">
                                  {link.domain}/{link.alias}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                  {link.url}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedLink && (
                  <p className="text-xs text-gray-500 truncate">
                    Destination: {selectedLink.url}
                  </p>
                )}
              </div>
            )}

            {/* Standalone Content */}
            {isStandalone && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Content</Label>
                <Input
                  placeholder="Enter URL, text, or any content to encode"
                  value={enteredContent}
                  onChange={(e) => setEnteredContent(e.target.value)}
                  className="h-10"
                />
                <p className="text-xs text-gray-500">
                  This content will be encoded directly into the QR code
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customization Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Design</CardTitle>
                <CardDescription>
                  Customize appearance and effects
                </CardDescription>
              </div>
              {hasPresetModifications ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleUpdatePreset}
                  disabled={updatePresetMutation.isLoading}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", updatePresetMutation.isLoading && "animate-spin")} />
                  <span className="hidden sm:inline">
                    {updatePresetMutation.isLoading ? "Updating..." : "Update Preset"}
                  </span>
                </Button>
              ) : (
                <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                      <Save className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Save Preset</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                      <DialogTitle>Save Style Preset</DialogTitle>
                      <DialogDescription>
                        Save your current style settings for reuse
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="preset-name" className="text-xs text-gray-600">
                          Preset Name
                        </Label>
                        <Input
                          id="preset-name"
                          placeholder="e.g., Brand Style, Marketing Campaign"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          className="h-10"
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
                      >
                        {createPresetMutation.isLoading ? "Saving..." : "Save Preset"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preset Selection */}
            {isLoadingPresets ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : presets && presets.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Saved Presets</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={cn(
                        "group relative flex items-center gap-1.5 rounded-xl border px-3 py-2 cursor-pointer transition-all duration-200",
                        selectedPresetId === preset.id
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                      onClick={() => loadPreset(preset.id)}
                    >
                      <span className="text-sm font-medium text-gray-700">{preset.name}</span>
                      <button
                        type="button"
                        className="rounded-md p-1 opacity-0 hover:bg-red-100 group-hover:opacity-100 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePresetMutation.mutate({ id: preset.id });
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
                <p className="text-xs text-gray-500">
                  No presets yet. Save your first style preset for quick reuse.
                </p>
              </div>
            )}

            <div className="border-t border-gray-100" />

            <QRAdvancedCustomization
              pixelStyle={qrState.pixelStyle}
              setPixelStyle={(style) => updateQrState({ pixelStyle: style })}
              markerShape={qrState.markerShape}
              setMarkerShape={(shape) => updateQrState({ markerShape: shape })}
              markerInnerShape={qrState.markerInnerShape === "auto" ? "auto" : qrState.markerInnerShape}
              setMarkerInnerShape={(shape) => updateQrState({ markerInnerShape: shape })}
              darkColor={qrState.darkColor}
              setDarkColor={(color) => updateQrState({ darkColor: color })}
              lightColor={qrState.lightColor}
              setLightColor={(color) => updateQrState({ lightColor: color })}
              effect={qrState.effect}
              setEffect={(effect) => updateQrState({ effect })}
              effectRadius={qrState.effectCrystalizeRadius}
              setEffectRadius={(radius) => updateQrState({
                effectCrystalizeRadius: radius,
                effectLiquidifyRadius: radius,
              })}
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
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Preview */}
      <div className="w-full lg:w-[40%]">
        <div className="sticky top-6 space-y-4">
          <Card className="overflow-hidden">
            <div className="relative">
              {/* Decorative header gradient */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gray-100 to-transparent" />

              <CardHeader className="relative pb-2">
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>Live preview of your QR code</CardDescription>
              </CardHeader>

              <CardContent className="relative flex flex-col items-center pb-8">
                {/* QR Code Container */}
                <div
                  className="relative rounded-2xl p-6 shadow-lg transition-all duration-300"
                  style={{
                    backgroundColor: qrState.lightColor,
                    boxShadow: '0 4px 24px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className="block"
                    style={{ maxWidth: "240px", width: "100%", height: "auto" }}
                  />
                </div>

                {/* Content Preview */}
                <div className="mt-6 w-full max-w-[280px]">
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-center text-xs text-gray-500 truncate">
                      {isStandalone
                        ? (enteredContent || "Enter content above")
                        : selectedLink
                          ? `${selectedLink.domain}/${selectedLink.alias}`
                          : "Select a link above"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full h-12 text-base font-medium shadow-sm"
            onClick={handleSaveQRCode}
            disabled={!canCreateMoreQRCodes}
          >
            <Download className="mr-2 h-4 w-4" />
            Generate & Download
          </Button>

          {!canCreateMoreQRCodes && (
            <p className="text-center text-xs text-gray-500">
              You've reached your QR code limit. Upgrade to create more.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRCodeCreationPage;
