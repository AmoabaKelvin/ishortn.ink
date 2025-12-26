"use client";

import { Check, ChevronsUpDown, Info, Loader2 } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
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
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-[65%] space-y-6">
        {/* Link Selection / Standalone Mode Card */}
        <Card className="bg-transparent">
          <CardHeader>
            <CardTitle>QR Code Type</CardTitle>
            <CardDescription>
              Choose whether to link to an existing shortened URL or create a
              standalone QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-2">
              <Label htmlFor="qr-title">QR Code Title</Label>
              <Input
                id="qr-title"
                placeholder="Enter a title for the QR Code"
                value={qrCodeTitle}
                onChange={(e) => setQRCodeTitle(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                This will be used to identify the QR Code in your dashboard
              </p>
            </div>

            <div className="pt-4 flex items-center justify-between space-x-2">
              <Label
                htmlFor="standalone-mode"
                className="flex flex-col gap-1.5"
              >
                <span>Standalone QR Code</span>
                <span className="font-normal text-xs text-muted-foreground">
                  Create a QR code with custom content (not linked to any
                  tracked URL).
                </span>
              </Label>
              <Switch
                id="standalone-mode"
                checked={isStandalone}
                onCheckedChange={setIsStandalone}
              />
            </div>

            {isStandalone && (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Standalone QR codes have no analytics tracking.</span>
              </div>
            )}

            {!isStandalone && (
              <div className="grid gap-3 pt-4">
                <Label>Select Link</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full justify-between"
                    >
                      {selectedLink
                        ? `${selectedLink.domain}/${selectedLink.alias}`
                        : "Select a link..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search links..."
                        value={search}
                        onValueChange={setSearch}
                      />
                      <CommandList>
                        {isLoadingLinks && (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                            Loading links...
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
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedLink?.id === link.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {link.domain}/{link.alias}
                                </span>
                                <span className="text-xs text-muted-foreground truncate max-w-[350px]">
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
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedLink.url}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Content Card */}
        {isStandalone && (
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>QR Code Content</CardTitle>
              <CardDescription>
                Enter the content for your standalone QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QRCodeContent
                qrCodeTitle={qrCodeTitle}
                setQRCodeTitle={setQRCodeTitle}
                enteredContent={enteredContent}
                setEnteredContent={setEnteredContent}
              />
            </CardContent>
          </Card>
        )}

        {/* Customization Card */}
        <Card className="bg-transparent">
          <CardHeader>
            <CardTitle>Customize Design</CardTitle>
            <CardDescription>
              Personalize your QR code appearance with advanced styling options
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            />
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={handleSaveQRCode}
          disabled={!canCreateMoreQRCodes}
        >
          Generate QR Code
        </Button>
      </div>

      {/* Preview Section */}
      <div className="w-full lg:w-[35%]">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Live preview of your QR code</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <canvas
              ref={canvasRef}
              className="max-w-full rounded-lg"
              style={{ maxWidth: "300px" }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default QRCodeCreationPage;
