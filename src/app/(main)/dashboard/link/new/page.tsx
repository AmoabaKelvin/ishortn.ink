"use client";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PLATFORM_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { clientLogger } from "@/lib/logger/client";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { createLinkSchema } from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/react";

const log = clientLogger.child({ component: "create-link-page" });

// Lazy load GeoRulesForm to reduce initial bundle size (includes framer-motion)
const GeoRulesForm = dynamic(
  () => import("../../_components/geo-rules-form").then((mod) => mod.GeoRulesForm),
  { ssr: false }
);
import { LinkExpirationDatePicker } from "../../_components/links/link-card/update-modal";
import { UtmParamsForm } from "../../_components/utm-params-form";
import { PlanBadge, SectionToggle } from "../../_components/section-toggle";
import { UtmTemplateSelector } from "../../_components/utm-template-selector";
import { revalidateHomepage } from "../../revalidate-homepage";

import { LinkPreviewComponent } from "./_components/link-preview";
import { OgImageUploader } from "./_components/og-image-uploader";
import UpgradeToProAIButtonTooltip from "./_components/upgrade-to-pro-ai-tooltip";

import type { CustomDomain } from "@/server/db/schema";
import type { z } from "zod";

type MetaData = {
  title: string;
  description: string;
  image: string;
  favicon: string;
};

export default function CreateLinkPage() {
  const router = useTransitionRouter();
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get("url") ?? undefined;
  const [destinationURL, setDestinationURL] = useState<string | undefined>(initialUrl);
  const [userDomains, setUserDomains] = useState<CustomDomain[]>([]);
  const [isCustomMetadataOpen, setIsCustomMetadataOpen] = useState(false);
  const [isUtmParamsOpen, setIsUtmParamsOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);
  const [generatedAliases, setGeneratedAliases] = useState<string[]>([]);
  const [currentAliasIndex, setCurrentAliasIndex] = useState(0);
  const [metaData, setMetaData] = useState({
    title: "",
    description: "",
    image: "",
    favicon: "",
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isLinkCloakingOpen, setIsLinkCloakingOpen] = useState(false);
  const [isCheckingIframeable, setIsCheckingIframeable] = useState(false);
  const [iframeableResult, setIframeableResult] = useState<boolean | null>(null);
  const [isVerifiedClicksOpen, setIsVerifiedClicksOpen] = useState(false);

  const userSubscription = api.subscriptions.get.useQuery();
  const customDomainsQuery = api.customDomain.list.useQuery();
  const generateAliasMutation = api.ai.generateAlias.useMutation({
    onSuccess: (data) => {
      setGeneratedAliases(data.alias);
      form.setValue("alias", data.alias[0]);
    },
  });
  const { data: userTags } = api.tag.list.useQuery();

  const form = useForm<z.infer<typeof createLinkSchema>>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: {
      domain: DEFAULT_PLATFORM_DOMAIN,
      ...(initialUrl ? { url: initialUrl } : {}),
    },
  });

  const [debouncedUrl] = useDebounce(destinationURL, 500);
  const [debouncedAlias] = useDebounce(form.watch("alias"), 500);
  const selectedDomain = form.watch("domain") ?? DEFAULT_PLATFORM_DOMAIN;

  async function generateAliases(metadata: {
    title: string;
    description: string;
  }) {
    generateAliasMutation.mutate({
      url: form.getValues("url"),
      title: metadata.title,
      description: metadata.description,
    });
  }

  const cycleAlias = (direction: "up" | "down") => {
    let newIndex: number;
    if (direction === "up") {
      newIndex = (currentAliasIndex + 1) % generatedAliases.length;
    } else {
      newIndex = (currentAliasIndex - 1 + generatedAliases.length) % generatedAliases.length;
    }
    setCurrentAliasIndex(newIndex);
    form.setValue("alias", generatedAliases[newIndex]);
  };

  const handleRegenerateClick = async () => {
    setCurrentAliasIndex(0);
    setGeneratedAliases([]);
    form.setValue("alias", "");

    const url = form.getValues("url");
    if (!url) {
      toast.error("Please enter a valid URL first");
      return;
    }

    // Get custom metadata from form - these take priority
    const customTitle = form.getValues("metadata.title");
    const customDescription = form.getValues("metadata.description");
    const customImage = form.getValues("metadata.image");

    let currentMetadata = metaData;

    // Only fetch if we don't have any metadata yet (custom or fetched)
    if (
      !currentMetadata.title &&
      !currentMetadata.description &&
      !customTitle &&
      !customDescription
    ) {
      try {
        const fetchedMetadata = await fetchMetadataInfo(url);
        currentMetadata = {
          title: customTitle || fetchedMetadata.title,
          description: customDescription || fetchedMetadata.description,
          image: customImage || fetchedMetadata.image,
          favicon: fetchedMetadata.favicon,
        };
        setMetaData(currentMetadata);
      } catch {
        toast.error("Failed to fetch metadata. Please try again.");
        return;
      }
    } else {
      // Use custom values if available
      currentMetadata = {
        ...currentMetadata,
        title: customTitle || currentMetadata.title,
        description: customDescription || currentMetadata.description,
        image: customImage || currentMetadata.image,
      };
    }

    await generateAliases(currentMetadata);
  };

  const formUpdateMutation = api.link.create.useMutation({
    onSuccess: async () => {
      await revalidateHomepage();
      toast.success("Link updated successfully");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkAliasAvailability = api.link.checkAliasAvailability.useQuery(
    { alias: debouncedAlias!, domain: selectedDomain },
    {
      enabled: !!debouncedAlias,
      onSuccess: (data) => {
        if (!data.isAvailable) {
          form.setError("alias", {
            type: "manual",
            message: "Alias is already taken",
          });
        } else {
          form.clearErrors("alias");
        }
      },
    },
  );

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

  async function onSubmit(values: z.infer<typeof createLinkSchema>) {
    values.tags = tags;
    await formUpdateMutation.mutateAsync(values);

    // Track events only after successful mutation
    if (values.password) {
      trackEvent(POSTHOG_EVENTS.LINK_CREATED_WITH_PASSWORD);
    }
    trackEvent(POSTHOG_EVENTS.LINK_CREATED, {
      has_custom_alias: !!values.alias,
      has_password: !!values.password,
      has_expiration: !!values.disableLinkAfterDate || !!values.disableLinkAfterClicks,
      domain: values.domain,
    });
    if (values.verifiedClicksEnabled) {
      trackEvent(POSTHOG_EVENTS.VERIFIED_CLICKS_ENABLED, {
        plan: userSubscription?.data?.subscriptions?.plan ?? "free",
        source: "create",
      });
    }
  }

  useEffect(() => {
    if (customDomainsQuery.data) {
      setUserDomains(customDomainsQuery.data);
    }
  }, [customDomainsQuery.data]);

  // Fetch platform-default metadata on initial load
  useEffect(() => {
    if (isInitialLoad) {
      fetchMetadataInfo(`https://${DEFAULT_PLATFORM_DOMAIN}`)
        .then((metadata) => {
          setMetaData(metadata);
        })
        .catch(() => {
          // Set fallback metadata if fetch fails
          setMetaData({
            title: "iShortn",
            description: "URL Shortener",
            image: "",
            favicon: "",
          });
        })
        .finally(() => {
          setIsInitialLoad(false);
        });
    }
  }, [isInitialLoad]);

  useEffect(() => {
    if (debouncedAlias) {
      void checkAliasAvailability.refetch();
    } else {
      form.clearErrors("alias");
    }
  }, [debouncedAlias, selectedDomain]);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!debouncedUrl || form.formState.errors.url || !form.getValues("url")) {
        return;
      }

      // Clear previous alias suggestions when URL changes
      setGeneratedAliases([]);
      form.setValue("alias", "");

      // Get custom metadata from form - these take priority over fetched metadata
      const customTitle = form.getValues("metadata.title");
      const customDescription = form.getValues("metadata.description");
      const customImage = form.getValues("metadata.image");

      try {
        const fetchedMetadata = await fetchMetadataInfo(debouncedUrl);

        // Only use fetched values for fields where user hasn't set custom values
        setMetaData((prev) => ({
          title: customTitle || fetchedMetadata.title,
          description: customDescription || fetchedMetadata.description,
          image: customImage || fetchedMetadata.image,
          favicon: fetchedMetadata.favicon,
        }));

        if (userSubscription?.data?.subscriptions?.status === "active") {
          generateAliasMutation.mutate({
            url: debouncedUrl,
            title: customTitle || fetchedMetadata.title,
            description: customDescription || fetchedMetadata.description,
          });
        }
      } catch (error) {
        // User-typing races and arbitrary destination URLs routinely fail
        // this fetch — not actionable, so warn-level avoids polluting error
        // dashboards with expected noise.
        log.warn({ err: error, action: "fetch-metadata" }, "failed to fetch metadata");
        // Don't overwrite user-entered metadata on failure
        // Don't generate aliases since we don't have valid metadata
      }
    };

    void fetchMetadata();
  }, [debouncedUrl]);

  // Check iframe compatibility when cloaking is enabled or URL changes while cloaking is on
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
          toast.error("This website doesn't allow cloaking.");
          form.setValue("cloaking", false);
        }
      } catch (error) {
        // Ignore abort errors (component unmounted or new request started)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        log.error(
          { err: error, action: "check-cloaking" },
          "failed to check cloaking compatibility",
        );
        setIframeableResult(false);
        form.setValue("cloaking", false);
        toast.error("Failed to check if URL can be cloaked. Please try again.");
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

  const isProUser = userSubscription?.data?.subscriptions?.status === "active";
  const isUltraUser = userSubscription?.data?.subscriptions?.plan === "ultra";

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      <div className="md:col-span-5">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">Create a new link</h2>
        <p className="mt-1 text-[13px] text-neutral-400">Create a new link to share with your audience.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-5">
            <div className="space-y-4 rounded-lg border border-neutral-200 dark:border-border p-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      Destination URL <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://site.com"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        {...field}
                        onChange={(e) => {
                          setDestinationURL(e.target.value);
                          field.onChange(e);
                        }}
                      />
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
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Link Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My Awesome Link"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
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
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Link Alias</FormLabel>
                    <FormControl>
                      <div className="flex h-9 w-full items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card transition-colors hover:border-neutral-300 dark:hover:border-border focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-300">
                        <Select
                          value={selectedDomain}
                          onValueChange={(value) => {
                            form.setValue("domain", value);
                          }}
                        >
                          <SelectTrigger className="h-full w-max shrink-0 gap-1 border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-500 shadow-none ring-0 hover:text-neutral-700 focus:ring-0">
                            <SelectValue placeholder={DEFAULT_PLATFORM_DOMAIN} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {PLATFORM_DOMAINS.map((domain) => (
                                <SelectItem key={domain} value={domain}>
                                  {domain}
                                </SelectItem>
                              ))}
                              {userDomains.length > 0 &&
                                userDomains.map((domain) => (
                                  <SelectItem key={domain.id} value={domain.domain!}>
                                    {domain.domain}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <div className="h-4 w-px bg-neutral-200 dark:bg-border" />
                        <input
                          placeholder="short-link"
                          className="h-full flex-1 border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-900 dark:text-foreground placeholder:text-neutral-400 focus:outline-none"
                          {...field}
                        />
                        <div className="flex h-full items-center border-l border-neutral-200 dark:border-border px-2">
                          {generateAliasMutation.isLoading ? (
                            <IconLoader2 size={16} stroke={1.5} className="animate-spin text-neutral-400" />
                          ) : generatedAliases.length > 0 ? (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => cycleAlias("up")}
                                aria-label="Previous alias suggestion"
                                className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                              >
                                <IconChevronUp size={14} stroke={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => cycleAlias("down")}
                                aria-label="Next alias suggestion"
                                className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                              >
                                <IconChevronDown size={14} stroke={1.5} />
                              </button>
                            </div>
                          ) : !isProUser ? (
                            <UpgradeToProAIButtonTooltip />
                          ) : (
                            <button
                              type="button"
                              onClick={handleRegenerateClick}
                              aria-label="Generate alias suggestions"
                              className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                            >
                              <IconSparkles size={16} stroke={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    </FormControl>
                    <AnimatePresence>
                      {generatedAliases.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <FormDescription className="flex justify-between text-[12px] text-neutral-400">
                            <motion.span key={currentAliasIndex}>
                              Suggestion {currentAliasIndex + 1} of {generatedAliases.length}
                            </motion.span>
                            <motion.span
                              className="cursor-pointer text-neutral-500 hover:text-neutral-700"
                              onClick={handleRegenerateClick}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Regenerate
                            </motion.span>
                          </FormDescription>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Note */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Note</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">Add a note to your link</FormDescription>
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
                        <div className="mb-2 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <div
                              key={tag}
                              className="flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-muted px-2 py-1 text-[12px] text-neutral-600 dark:text-neutral-400"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                aria-label={`Remove tag ${tag}`}
                                className="text-neutral-400 hover:text-neutral-600"
                              >
                                <IconX size={12} stroke={1.5} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="relative">
                          <Input
                            placeholder="Add tags (press Enter to add)"
                            className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                            value={tagInput}
                            onChange={(e) => {
                              setTagInput(e.target.value);
                              setShowTagDropdown(true);
                            }}
                            onKeyDown={handleTagKeyDown}
                            onBlur={() => {
                              setTimeout(() => setShowTagDropdown(false), 200);
                            }}
                            onFocus={() => {
                              setShowTagDropdown(true);
                            }}
                          />

                          {/* Tag dropdown */}
                          {showTagDropdown && filteredTags.length > 0 && (
                            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card shadow-md">
                              {filteredTags.map((tag) => (
                                <div
                                  key={tag}
                                  className="cursor-pointer px-4 py-2 text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50"
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
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
                      Add tags to categorize your links. Press Enter to add a tag or select from
                      existing tags.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Custom Metadata Section */}
            <SectionToggle
              title="Custom Social Media Previews"
              description="Personalize your link previews with custom metadata settings"
              isOpen={isCustomMetadataOpen}
              onToggle={() => setIsCustomMetadataOpen(!isCustomMetadataOpen)}
              badge={!isProUser ? <PlanBadge plan="Pro" /> : undefined}
            >
              <FormField
                control={form.control}
                name="metadata.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Custom Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Custom title for your link"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        onChange={(e) => {
                          field.onChange(e);
                          setMetaData((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }));
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metadata.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Custom Description</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Custom description for your link"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                        onChange={(e) => {
                          field.onChange(e);
                          setMetaData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }));
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metadata.image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Custom Image</FormLabel>
                    <FormControl>
                      <OgImageUploader
                        value={field.value}
                        onChange={(image) => {
                          field.onChange(image);
                          setMetaData((prev) => ({
                            ...prev,
                            image: image || "",
                          }));
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </SectionToggle>

            {/* UTM Parameters Section */}
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
                      form.setValue("utmParams.utm_source", params.utm_source ?? "");
                      form.setValue("utmParams.utm_medium", params.utm_medium ?? "");
                      form.setValue("utmParams.utm_campaign", params.utm_campaign ?? "");
                      form.setValue("utmParams.utm_term", params.utm_term ?? "");
                      form.setValue("utmParams.utm_content", params.utm_content ?? "");
                    }}
                  />
                </div>
              )}
              <UtmParamsForm
                form={form}
                disabled={!isUltraUser}
              />
            </SectionToggle>

            {/* Link Cloaking Section */}
            <SectionToggle
              title="Link Cloaking"
              description="Keep your short URL visible while showing destination content"
              isOpen={isLinkCloakingOpen}
              onToggle={() => setIsLinkCloakingOpen(!isLinkCloakingOpen)}
              badge={!isUltraUser ? <PlanBadge plan="Ultra" /> : undefined}
              highlighted={!!form.watch("cloaking")}
            >
              <FormField
                control={form.control}
                name="cloaking"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-neutral-200 dark:border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                        Enable Link Cloaking
                      </FormLabel>
                      <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                        Visitors see your short URL while viewing the destination page.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        {isCheckingIframeable && (
                          <IconLoader2 size={14} stroke={1.5} className="animate-spin text-neutral-400" />
                        )}
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                          disabled={
                            !isUltraUser ||
                            !destinationURL ||
                            isCheckingIframeable
                          }
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {!isUltraUser && (
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  Link cloaking is an Ultra plan feature.
                </p>
              )}

              {!destinationURL && isUltraUser && (
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  Enter a destination URL above to enable link cloaking.
                </p>
              )}

              {iframeableResult === true && cloakingEnabled && (
                <p className="text-[12px] text-green-600 dark:text-emerald-400">
                  This URL can be cloaked successfully.
                </p>
              )}

              {iframeableResult === false && (
                <p className="text-[12px] text-amber-600 dark:text-amber-400">
                  This website doesn&apos;t allow cloaking. Try a different URL.
                </p>
              )}
            </SectionToggle>

            {/* Verified Clicks Section */}
            <SectionToggle
              title="Verified Clicks"
              description="Tell real visitors apart from automated traffic"
              isOpen={isVerifiedClicksOpen}
              onToggle={() => setIsVerifiedClicksOpen(!isVerifiedClicksOpen)}
              badge={!isProUser ? <PlanBadge plan="Pro" /> : undefined}
              highlighted={!!form.watch("verifiedClicksEnabled")}
            >
              <FormField
                control={form.control}
                name="verifiedClicksEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-neutral-200 dark:border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                        Enable Verified Clicks
                      </FormLabel>
                      <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                        With this on, your analytics shows which clicks came from real visitors, not automated traffic — so you can tell real engagement apart from noise.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={!isProUser}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!isProUser && (
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  Verified clicks are available on Pro and Ultra plans.
                </p>
              )}
            </SectionToggle>

            {/* Geotargeting Rules Section */}
            <GeoRulesForm
              form={form}
              disabled={!isProUser}
              maxRules={isUltraUser ? undefined : 3}
              isUnlimited={isUltraUser}
            />

            {/* Optional Settings Section */}
            <SectionToggle
              title="Optional Settings"
              description="Configure additional options for your link"
              isOpen={isOptionalSettingsOpen}
              onToggle={() => setIsOptionalSettingsOpen(!isOptionalSettingsOpen)}
            >
              <FormField
                control={form.control}
                name="disableLinkAfterClicks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Disable after clicks</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]"
                      />
                    </FormControl>
                    <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Deactivate the link after a certain number of clicks. Leave empty to
                      never disable
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
                      <LinkExpirationDatePicker setSeletectedDate={field.onChange} />
                    </FormControl>
                    <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Deactivate the link after a certain date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                disabled={!isProUser}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Password</FormLabel>
                    {!userSubscription.isLoading && !isProUser && (
                      <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                        You need to be on a <b>pro plan</b> to create password protected
                        links
                      </FormDescription>
                    )}
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]"
                      />
                    </FormControl>
                    <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Set a password to protect your link
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionToggle>

            <Button
              type="submit"
              className="mt-10 w-full bg-blue-600 text-[13px] hover:bg-blue-700"
              onClick={form.handleSubmit(onSubmit)}
              disabled={formUpdateMutation.isLoading}
            >
              {formUpdateMutation.isLoading ? "Creating..." : "Create Link"}
            </Button>
          </form>
        </Form>
      </div>
      <div className="hidden items-center justify-center md:flex">
        <div className="h-screen border-r border-neutral-200 dark:border-border" />
      </div>
      <div className="mt-4 flex flex-col gap-4 md:col-span-5 md:mt-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">How users see your link</h1>
          <p className="text-[13px] text-neutral-400">
            This is how your link will be displayed to users on social platforms
          </p>
        </div>
        <LinkPreviewComponent
          destinationURL={destinationURL}
          metaTitle={metaData.title}
          metaDescription={metaData.description}
          metaImage={metaData.image}
          favicon={metaData.favicon}
        />
      </div>
    </section>
  );
}
