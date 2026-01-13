"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarIcon, ChevronDown, Gem, Loader2, MousePointerClick, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { UtmParamsForm } from "@/app/(main)/dashboard/_components/utm-params-form";
import { UtmTemplateSelector } from "@/app/(main)/dashboard/_components/utm-template-selector";
import { OgImageUploader } from "@/app/(main)/dashboard/link/new/_components/og-image-uploader";
import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { updateLinkSchema } from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/react";
import { useDebounce } from "use-debounce";

import type { RouterOutputs } from "@/trpc/shared";
import type { z } from "zod";

type LinkMetadata = {
  title?: string;
  description?: string;
  image?: string;
};

type EditLinkDrawerProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  open: boolean;
  onClose: () => void;
};

export function EditLinkDrawer({ link, open, onClose }: EditLinkDrawerProps) {
  const [tags, setTags] = useState<string[]>((link.tags as string[]) || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isCustomMetadataOpen, setIsCustomMetadataOpen] = useState(false);
  const [isUtmParamsOpen, setIsUtmParamsOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);
  const [isLinkCloakingOpen, setIsLinkCloakingOpen] = useState(false);
  const [isCheckingIframeable, setIsCheckingIframeable] = useState(false);
  const [iframeableResult, setIframeableResult] = useState<boolean | null>(null);

  const { data: userTags } = api.tag.list.useQuery();
  const userSubscription = api.subscriptions.get.useQuery();

  const formUpdateMutation = api.link.update.useMutation({
    onSuccess: async () => {
      await revalidateHomepage();
    },
  });

  const getFormDefaults = (linkData: typeof link) => {
    const metadata = linkData.metadata as LinkMetadata | undefined;
    return {
      id: linkData.id,
      name: linkData.name ?? "",
      url: linkData.url ?? "",
      alias: linkData.alias ?? "",
      note: linkData.note ?? undefined,
      disableLinkAfterClicks: linkData.disableLinkAfterClicks ?? undefined,
      disableLinkAfterDate: linkData.disableLinkAfterDate ?? undefined,
      tags: (linkData.tags as string[]) || [],
      metadata: {
        title: metadata?.title ?? undefined,
        description: metadata?.description ?? undefined,
        image: metadata?.image ?? undefined,
      },
      utmParams:
        (linkData.utmParams as {
          utm_source?: string;
          utm_medium?: string;
          utm_campaign?: string;
          utm_term?: string;
          utm_content?: string;
        }) ?? undefined,
      cloaking: linkData.cloaking ?? false,
    };
  };

  const form = useForm<z.infer<typeof updateLinkSchema>>({
    resolver: zodResolver(updateLinkSchema),
    defaultValues: getFormDefaults(link),
  });

  useEffect(() => {
    form.reset(getFormDefaults(link));
    setTags((link.tags as string[]) || []);
  }, [link]);

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

  const filteredTags = userTags
    ? userTags
        .filter(
          (tag) =>
            (tagInput === "" || tag.name.toLowerCase().includes(tagInput.toLowerCase())) &&
            !tags.includes(tag.name),
        )
        .map((tag) => tag.name)
    : [];

  async function onSubmit(values: z.infer<typeof updateLinkSchema>) {
    values.tags = tags;
    toast.promise(
      formUpdateMutation.mutateAsync(values).then(() => {
        onClose();
      }),
      {
        loading: "Updating link...",
        success: "Link updated successfully",
        error: "Failed to update link",
      },
    );
  }

  const subscriptionStatus = userSubscription?.data?.subscriptions;
  const isUltraUser = subscriptionStatus?.plan === "ultra";
  const isProOrUltraUser = subscriptionStatus?.status === "active";

  // Watch the URL field for debouncing
  const watchedUrl = form.watch("url");
  const [debouncedUrl] = useDebounce(watchedUrl, 500);

  // Check iframe compatibility when cloaking is enabled or URL changes
  const cloakingEnabled = form.watch("cloaking");
  useEffect(() => {
    const controller = new AbortController();

    const checkIframeable = async () => {
      if (!cloakingEnabled || !debouncedUrl) {
        setIframeableResult(null);
        return;
      }

      // Validate URL format first
      try {
        new URL(debouncedUrl);
      } catch {
        setIframeableResult(null);
        return;
      }

      setIsCheckingIframeable(true);
      try {
        const response = await fetch(
          `/api/links/iframeable?url=${encodeURIComponent(debouncedUrl)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setIframeableResult(data.iframeable);

        if (!data.iframeable) {
          toast.error("This website doesn't allow cloaking. Cloaking has been disabled.");
          form.setValue("cloaking", false);
        }
      } catch (error) {
        // Ignore abort errors (component unmounted or new request started)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to check iframe compatibility:", error);
        setIframeableResult(false);
        form.setValue("cloaking", false);
        toast.error("Failed to verify if URL can be cloaked. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingIframeable(false);
        }
      }
    };

    void checkIframeable();

    return () => {
      controller.abort();
    };
  }, [cloakingEnabled, debouncedUrl, form]);

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
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
          >
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Link</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {link.domain}/{link.alias}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="h-4 w-4 text-blue-600" />
                      {link.totalClicks} clicks
                    </span>
                    <span>
                      Created{" "}
                      {link.createdAt ? format(new Date(link.createdAt), "MMM d, yyyy") : "Unknown"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto">
              <Form {...form}>
                <form className="space-y-5 p-6">
                  {/* Basic Information */}
                  <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destination URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://site.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Awesome Link" {...field} />
                          </FormControl>
                          <FormDescription>
                            A friendly name to identify your link (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="alias"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link Alias</FormLabel>
                          <FormControl>
                            <div className="flex h-9 w-full items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 hover:border-gray-300">
                              <Select>
                                <SelectTrigger className="h-full w-max shrink-0 gap-1 border-0 bg-transparent px-3 text-sm font-medium text-gray-600 shadow-none ring-0 hover:text-gray-900 focus:ring-0">
                                  <SelectValue placeholder={link.domain || "ishortn.ink"} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="ishortn.ink">ishortn.ink</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <div className="h-4 w-px bg-gray-200" />
                              <input
                                placeholder="short-link"
                                className="h-full flex-1 border-0 bg-transparent px-3 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note</FormLabel>
                          <FormControl>
                            <Input placeholder="Add a note to your link" {...field} />
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
                          <FormLabel>Tags</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <div className="mb-2 flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                  <div
                                    key={tag}
                                    className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm"
                                  >
                                    <span>{tag}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeTag(tag)}
                                      aria-label={`Remove tag ${tag}`}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="relative">
                                <Input
                                  placeholder="Add tags (press Enter to add)"
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
                                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                    {filteredTags.map((tag) => (
                                      <div
                                        key={tag}
                                        className="cursor-pointer px-4 py-2 hover:bg-gray-100"
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
                          <FormDescription>
                            Add tags to categorize your links. Press Enter to add a tag or select
                            from existing tags.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Custom Social Media Previews Section */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setIsCustomMetadataOpen(!isCustomMetadataOpen)}
                    >
                      <div className="flex flex-col">
                        <p className="flex items-center gap-2 text-lg font-semibold">
                          Custom Social Media Previews
                          {!isProOrUltraUser && (
                            <span className="flex max-w-fit items-center space-x-1 whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800">
                              <Gem className="h-4 w-4 text-slate-500" />
                              <span className="uppercase">Pro</span>
                            </span>
                          )}
                        </p>
                        <span className="text-sm text-gray-500">
                          Personalize your link previews with custom metadata
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${
                          isCustomMetadataOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isCustomMetadataOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="mt-4 space-y-4">
                            <FormField
                              control={form.control}
                              name="metadata.title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Custom Title</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Custom title for your link"
                                      disabled={!isProOrUltraUser}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="metadata.description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Custom Description</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Custom description for your link"
                                      disabled={!isProOrUltraUser}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="metadata.image"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Custom Image</FormLabel>
                                  <FormControl>
                                    {isProOrUltraUser ? (
                                      <OgImageUploader
                                        value={field.value}
                                        onChange={field.onChange}
                                      />
                                    ) : (
                                      <Input
                                        placeholder="Upgrade to Pro to add custom images"
                                        disabled
                                      />
                                    )}
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* UTM Parameters Section */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setIsUtmParamsOpen(!isUtmParamsOpen)}
                    >
                      <div className="flex flex-col">
                        <p className="flex items-center gap-2 text-lg font-semibold">
                          UTM Parameters
                          {!isUltraUser && (
                            <span className="flex max-w-fit items-center space-x-1 whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800">
                              <Gem className="h-4 w-4 text-slate-500" />
                              <span className="uppercase">Ultra</span>
                            </span>
                          )}
                        </p>
                        <span className="text-sm text-gray-500">
                          Add UTM parameters for campaign tracking
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${
                          isUtmParamsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isUtmParamsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="mt-4 space-y-3">
                            {isUltraUser && (
                              <div className="flex justify-end">
                                <UtmTemplateSelector
                                  onSelect={(params) => {
                                    form.setValue(
                                      "utmParams.utm_source",
                                      params.utm_source ?? undefined,
                                    );
                                    form.setValue(
                                      "utmParams.utm_medium",
                                      params.utm_medium ?? undefined,
                                    );
                                    form.setValue(
                                      "utmParams.utm_campaign",
                                      params.utm_campaign ?? undefined,
                                    );
                                    form.setValue(
                                      "utmParams.utm_term",
                                      params.utm_term ?? undefined,
                                    );
                                    form.setValue(
                                      "utmParams.utm_content",
                                      params.utm_content ?? undefined,
                                    );
                                  }}
                                />
                              </div>
                            )}
                            <UtmParamsForm form={form} disabled={!isUltraUser} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Link Cloaking Section */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setIsLinkCloakingOpen(!isLinkCloakingOpen)}
                    >
                      <div className="flex flex-col">
                        <p className="flex items-center gap-2 text-lg font-semibold">
                          Link Cloaking
                          {!isUltraUser && (
                            <span className="flex max-w-fit items-center space-x-1 whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800">
                              <Gem className="h-4 w-4 text-slate-500" />
                              <span className="uppercase">Ultra</span>
                            </span>
                          )}
                        </p>
                        <span className="text-sm text-gray-500">
                          Keep your short URL visible in the browser while showing the destination
                          content
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${
                          isLinkCloakingOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isLinkCloakingOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="mt-4 space-y-4">
                            <FormField
                              control={form.control}
                              name="cloaking"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Enable Link Cloaking
                                    </FormLabel>
                                    <FormDescription>
                                      Visitors will see your short URL in their browser address bar
                                      while viewing the destination page content.
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <div className="flex items-center gap-2">
                                      {isCheckingIframeable && (
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                      )}
                                      <Switch
                                        checked={field.value ?? false}
                                        onCheckedChange={field.onChange}
                                        disabled={
                                          !isUltraUser || !watchedUrl || isCheckingIframeable
                                        }
                                      />
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {!isUltraUser && (
                              <p className="text-sm text-gray-500">
                                Link cloaking is an Ultra plan feature. Upgrade to unlock this and
                                other advanced features.
                              </p>
                            )}

                            {!watchedUrl && isUltraUser && (
                              <p className="text-sm text-gray-500">
                                Enter a destination URL above to enable link cloaking.
                              </p>
                            )}

                            {iframeableResult === true && cloakingEnabled && (
                              <p className="text-sm text-green-600">
                                This URL can be cloaked successfully.
                              </p>
                            )}

                            {iframeableResult === false && (
                              <p className="text-sm text-amber-600">
                                This website doesn&apos;t allow cloaking. Try a different URL.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Optional Settings Section */}
                  <div className="rounded-lg border border-gray-200 p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setIsOptionalSettingsOpen(!isOptionalSettingsOpen)}
                    >
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold">Optional Settings</span>
                        <span className="text-sm text-gray-500">
                          Configure additional options for your link
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${
                          isOptionalSettingsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOptionalSettingsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="mt-4 space-y-4">
                            <FormField
                              control={form.control}
                              name="disableLinkAfterClicks"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Disable after clicks</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" />
                                  </FormControl>
                                  <FormDescription>
                                    Deactivate the link after a certain number of clicks. Leave
                                    empty to never disable
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
                                  <FormLabel>Disable after date</FormLabel>
                                  <FormControl>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground",
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
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
                                  <FormDescription>
                                    Deactivate the link after a certain date
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </form>
              </Form>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={formUpdateMutation.isLoading}
                >
                  {formUpdateMutation.isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
