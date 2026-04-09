"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconCalendar,
  IconClick,
  IconQrcode,
  IconX,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const GeoRulesForm = dynamic(
  () =>
    import("@/app/(main)/dashboard/_components/geo-rules-form").then(
      (mod) => mod.GeoRulesForm
    ),
  { ssr: false }
);
import { PlanBadge, SectionToggle } from "@/app/(main)/dashboard/_components/section-toggle";
import { UtmParamsForm } from "@/app/(main)/dashboard/_components/utm-params-form";
import { UtmTemplateSelector } from "@/app/(main)/dashboard/_components/utm-template-selector";
import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { qrcodeUpdateInput } from "@/server/api/routers/qrcode/qrcode.input";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";
import type { z } from "zod";

type EditQRCodeFormValues = z.infer<typeof qrcodeUpdateInput>;

type EditQRCodeDrawerProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  open: boolean;
  onClose: () => void;
};

type QRCodeData = RouterOutputs["qrCode"]["list"][number];
type GeoRulesData = RouterOutputs["geoRules"]["getByLinkId"];

function getFormDefaults(
  qrData: QRCodeData,
  geoRules?: GeoRulesData,
): EditQRCodeFormValues {
  return {
    id: qrData.id,
    title: qrData.title ?? "",
    url: qrData.link?.url ?? qrData.content ?? "",
    note: qrData.link?.note ?? undefined,
    tags: (qrData.link?.tags as string[]) || [],
    utmParams:
      (qrData.link?.utmParams as {
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        utm_term?: string;
        utm_content?: string;
      }) ?? undefined,
    geoRules:
      geoRules?.map((rule) => ({
        type: rule.type,
        condition: rule.condition,
        values: rule.values,
        action: rule.action,
        destination: rule.destination ?? undefined,
        blockMessage: rule.blockMessage ?? undefined,
      })) ?? [],
    disableLinkAfterClicks: qrData.link?.disableLinkAfterClicks ?? undefined,
    disableLinkAfterDate: qrData.link?.disableLinkAfterDate ?? undefined,
  };
}

export function EditQRCodeDrawer({ qr, open, onClose }: EditQRCodeDrawerProps) {
  const [tags, setTags] = useState<string[]>((qr.link?.tags as string[]) || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isUtmParamsOpen, setIsUtmParamsOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);

  const { data: userTags } = api.tag.list.useQuery(undefined, { enabled: open });
  const userSubscription = api.subscriptions.get.useQuery(undefined, { enabled: open });
  const { data: existingGeoRules } = api.geoRules.getByLinkId.useQuery(
    { linkId: qr.link?.id ?? 0 },
    { enabled: open && !!qr.link?.id }
  );

  const updateMutation = api.qrCode.update.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
      onClose();
    },
  });

  const form = useForm<EditQRCodeFormValues>({
    resolver: zodResolver(qrcodeUpdateInput),
    defaultValues: getFormDefaults(qr, existingGeoRules),
  });

  // Reset form when switching QR codes or when geo rules finish loading.
  // Use qr.id (stable primitive) instead of qr (object ref) to avoid
  // resetting on every parent re-render and discarding unsaved edits.
  useEffect(() => {
    if (!open) return;
    // Wait for geo rules to load before resetting (avoids a double reset)
    if (qr.link?.id && existingGeoRules === undefined) return;
    form.reset(getFormDefaults(qr, existingGeoRules));
    setTags((qr.link?.tags as string[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr.id, existingGeoRules, open]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      addTag(tagInput.trim());
    } else if (e.key === "ArrowDown" && userTags && userTags.length > 0) {
      setShowTagDropdown(true);
    }
  };

  const addTag = (tagToAdd: string) => {
    if (!tags.includes(tagToAdd)) {
      const newTags = [...tags, tagToAdd];
      setTags(newTags);
      form.setValue("tags", newTags);
      setTagInput("");
    }
    setShowTagDropdown(false);
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    form.setValue("tags", newTags);
  };

  const filteredTags = useMemo(
    () =>
      userTags
        ? userTags
            .filter(
              (tag) =>
                (tagInput === "" || tag.name.toLowerCase().includes(tagInput.toLowerCase())) &&
                !tags.includes(tag.name),
            )
            .map((tag) => tag.name)
        : [],
    [userTags, tags, tagInput],
  );

  async function onSubmit(values: EditQRCodeFormValues) {
    values.tags = tags;
    toast.promise(updateMutation.mutateAsync(values), {
      loading: "Updating QR code...",
      success: "QR code updated successfully",
      error: "Failed to update QR code",
    });
  }

  const subscriptionStatus = userSubscription?.data?.subscriptions;
  const isUltraUser = subscriptionStatus?.plan === "ultra";
  const isProOrUltraUser = subscriptionStatus?.status === "active";

  const scans = qr.visitCount ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ willChange: "opacity" }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-neutral-200 dark:border-border bg-white dark:bg-card"
          >
            {/* Header */}
            <div className="border-b border-neutral-200 dark:border-border px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">Edit QR Code</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                    <IconQrcode size={14} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
                    {qr.title || "Untitled QR Code"}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-neutral-400 dark:text-neutral-500">
                    <span className="flex items-center gap-1">
                      <IconClick size={14} stroke={1.5} className="text-blue-600 dark:text-blue-400" />
                      {scans} scans
                    </span>
                    <span>
                      Created{" "}
                      {qr.createdAt ? format(new Date(qr.createdAt), "MMM d, yyyy") : "Unknown"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="rounded-md p-1 text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600"
                >
                  <IconX size={18} stroke={1.5} />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto">
              <Form {...form}>
                <form className="space-y-4 p-6">
                  {/* Basic Information */}
                  <div className="space-y-4 rounded-lg border border-neutral-200 dark:border-border p-4">
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Destination URL</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                              placeholder="https://site.com"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Change where this QR code redirects to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">QR Code Title</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                              placeholder="My QR Code"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            A friendly name to identify your QR code (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Note</FormLabel>
                          <FormControl>
                            <Input
                              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                              placeholder="Add a note to your QR code"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Tags */}
                    <FormField
                      control={form.control}
                      name="tags"
                      render={() => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Tags</FormLabel>
                          <FormControl>
                            <div className="relative">
                              {tags.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {tags.map((tag) => (
                                    <div
                                      key={tag}
                                      className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-muted px-2 py-0.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400"
                                    >
                                      <span>{tag}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        aria-label={`Remove tag ${tag}`}
                                        className="text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-600"
                                      >
                                        <IconX size={12} stroke={1.5} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="relative">
                                <Input
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                                  placeholder="Add tags (press Enter)"
                                  value={tagInput}
                                  onChange={(e) => {
                                    setTagInput(e.target.value);
                                    setShowTagDropdown(true);
                                  }}
                                  onKeyDown={handleTagKeyDown}
                                  onBlur={() => {
                                    setTimeout(() => setShowTagDropdown(false), 200);
                                  }}
                                  onFocus={() => setShowTagDropdown(true)}
                                />

                                {showTagDropdown && filteredTags.length > 0 && (
                                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card shadow-md">
                                    {filteredTags.map((tag) => (
                                      <div
                                        key={tag}
                                        className="cursor-pointer px-3 py-2 text-[13px] text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          addTag(tag);
                                        }}
                                      >
                                        {tag}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Press Enter to add a tag, or select from existing tags.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* UTM Parameters */}
                  <SectionToggle
                    title="UTM Parameters"
                    description="Add UTM parameters for campaign tracking"
                    isOpen={isUtmParamsOpen}
                    onToggle={() => setIsUtmParamsOpen(!isUtmParamsOpen)}
                    badge={!isUltraUser ? <PlanBadge plan="Ultra" /> : undefined}
                  >
                    {isUltraUser && (
                      <div className="flex justify-end">
                        <UtmTemplateSelector
                          onSelect={(params) => {
                            form.setValue("utmParams.utm_source", params.utm_source ?? undefined);
                            form.setValue("utmParams.utm_medium", params.utm_medium ?? undefined);
                            form.setValue("utmParams.utm_campaign", params.utm_campaign ?? undefined);
                            form.setValue("utmParams.utm_term", params.utm_term ?? undefined);
                            form.setValue("utmParams.utm_content", params.utm_content ?? undefined);
                          }}
                        />
                      </div>
                    )}
                    <UtmParamsForm form={form} disabled={!isUltraUser} />
                  </SectionToggle>

                  {/* Geotargeting Rules */}
                  <GeoRulesForm
                    form={form}
                    disabled={!isProOrUltraUser}
                    maxRules={isUltraUser ? undefined : 3}
                    isUnlimited={isUltraUser}
                  />

                  {/* Optional Settings */}
                  <SectionToggle
                    title="Optional Settings"
                    description="Configure additional options for your QR code"
                    isOpen={isOptionalSettingsOpen}
                    onToggle={() => setIsOptionalSettingsOpen(!isOptionalSettingsOpen)}
                  >
                    <FormField
                      control={form.control}
                      name="disableLinkAfterClicks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Disable after scans</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                            />
                          </FormControl>
                          <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Deactivate after a certain number of scans. Leave empty to never disable.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="disableLinkAfterDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Disable after date</FormLabel>
                          <FormControl>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-9 w-full justify-start border-neutral-200 dark:border-border text-left text-[13px] font-normal hover:bg-neutral-50 dark:hover:bg-accent/50",
                                    !field.value && "text-neutral-400 dark:text-neutral-500",
                                  )}
                                >
                                  <IconCalendar size={14} stroke={1.5} className="mr-2 text-neutral-400 dark:text-neutral-500" />
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date)}
                                  initialFocus
                                  disabled={(date) => date < new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Deactivate the QR code after a certain date.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SectionToggle>
                </form>
              </Form>
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={updateMutation.isLoading}
                  className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
                >
                  {updateMutation.isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
