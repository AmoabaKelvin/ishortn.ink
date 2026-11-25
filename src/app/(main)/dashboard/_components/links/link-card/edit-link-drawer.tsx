"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconCalendar, IconClick, IconLoader2, IconX } from "@tabler/icons-react";
import { TRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Lazy load GeoRulesForm to reduce initial bundle size (includes framer-motion)
const GeoRulesForm = dynamic(
  () => import("@/app/(main)/dashboard/_components/geo-rules-form").then((mod) => mod.GeoRulesForm),
  { ssr: false },
);
import { useDebounce } from "use-debounce";

import { DateTimePicker } from "@/app/(main)/dashboard/_components/date-time-picker";
import { checkIframeable } from "@/app/(main)/dashboard/_components/links/check-iframeable";
import { MilestoneEditor } from "@/app/(main)/dashboard/_components/milestone-form";
import { PlanBadge, SectionToggle } from "@/app/(main)/dashboard/_components/section-toggle";
import { UtmParamsForm } from "@/app/(main)/dashboard/_components/utm-params-form";
import { UtmTemplateSelector } from "@/app/(main)/dashboard/_components/utm-template-selector";
import { OgImageUploader } from "@/app/(main)/dashboard/link/new/_components/og-image-uploader";
import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogDescription, DialogPortal, DialogTitle } from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { UpgradeCta } from "@/components/upgrade-cta";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import {
  isPlanLimitError,
  linkEditLimitSource,
  requiredPlanForLimit,
} from "@/lib/billing/required-plan";
import { clientLogger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";
import { normalizeDestinationUrl } from "@/lib/utils/destination-url";
import {
  LINK_ALIAS_MAX_LENGTH,
  LINK_NAME_MAX_LENGTH,
  LINK_NOTE_MAX_LENGTH,
  updateLinkSchema,
} from "@/server/api/routers/link/link.input";
import { normalizeTagName } from "@/server/api/routers/tag/utils";
import { api } from "@/trpc/react";

import {
  geoRulesToFormValues,
  geoRulesToSubmit,
  mergeMilestones,
  selectLinkDomain,
  useEditLinkFormSync,
} from "./edit-link-form";
import { LinkDomainSelect } from "./link-domain-select";

import type { MilestoneEntry } from "@/app/(main)/dashboard/_components/milestone-form";

const log = clientLogger.child({ component: "edit-link-drawer" });

import { useUpgradeOffer } from "../../upgrade-offer";

import type { LinkCardLink } from "./types";

// `link.metadata` is an untyped JSON column; older rows may hold partial or foreign shapes.
const storedLinkMetadataSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
  })
  .catch({});

type EditLinkDrawerProps = {
  link: LinkCardLink;
  open: boolean;
  onClose: () => void;
};

export function EditLinkDrawer({ link, open, onClose }: EditLinkDrawerProps) {
  const [tags, setTags] = useState<string[]>(link.tags);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isCustomMetadataOpen, setIsCustomMetadataOpen] = useState(false);
  const [isUtmParamsOpen, setIsUtmParamsOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);
  const [isLinkCloakingOpen, setIsLinkCloakingOpen] = useState(false);
  const [isCheckingIframeable, setIsCheckingIframeable] = useState(false);
  const [iframeableResult, setIframeableResult] = useState<boolean | null>(null);
  const [isVerifiedClicksOpen, setIsVerifiedClicksOpen] = useState(false);
  const [isMilestonesOpen, setIsMilestonesOpen] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [milestonesEdited, setMilestonesEdited] = useState(false);

  const { data: userTags } = api.tag.list.useQuery();
  const userSubscription = api.subscriptions.get.useQuery();
  const upgradeOffer = useUpgradeOffer();
  const { data: existingGeoRules } = api.geoRules.getByLinkId.useQuery(
    { linkId: link.id },
    { enabled: open },
  );
  const { data: existingMilestones } = api.linkMilestone.getByLinkId.useQuery(
    { linkId: link.id },
    { enabled: open },
  );

  const [syncedLink, setSyncedLink] = useState(link);
  const [syncedMilestones, setSyncedMilestones] = useState(existingMilestones);
  const [syncedOpen, setSyncedOpen] = useState(open);
  const shouldReduceMotion = useReducedMotion();

  const toMilestoneEntries = (saved: typeof existingMilestones): MilestoneEntry[] =>
    (saved ?? []).map((m) => ({ threshold: m.threshold, notifiedAt: m.notifiedAt }));
  const resetMilestones = () => setMilestones(toMilestoneEntries(existingMilestones));

  // Reopening starts from the saved link, not from edits that were abandoned.
  if (syncedOpen !== open) {
    setSyncedOpen(open);
    if (open) {
      setTags(link.tags);
      setTagInput("");
      setMilestonesEdited(false);
      resetMilestones();
    }
  }
  if (syncedLink !== link) {
    setSyncedLink(link);
    setTags(link.tags);
  }
  // Milestones load after the dialog opens: thresholds added meanwhile are kept, alongside the
  // saved ones, and a later refetch doesn't overwrite edits.
  if (syncedMilestones !== existingMilestones) {
    setSyncedMilestones(existingMilestones);
    if (!milestonesEdited) {
      resetMilestones();
    } else if (syncedMilestones === undefined) {
      setMilestones(mergeMilestones(toMilestoneEntries(existingMilestones), milestones));
    }
  }

  const utils = api.useUtils();
  const formUpdateMutation = api.link.update.useMutation();
  const milestoneUpsertMutation = api.linkMilestone.upsert.useMutation();
  const isSaving = formUpdateMutation.isLoading || milestoneUpsertMutation.isLoading;

  const getFormDefaults = (linkData: typeof link, geoRules?: typeof existingGeoRules) => {
    const metadata = storedLinkMetadataSchema.parse(linkData.metadata);
    return {
      id: linkData.id,
      name: linkData.name ?? "",
      url: linkData.url ?? "",
      alias: linkData.alias ?? "",
      domain: linkData.domain,
      note: linkData.note ?? undefined,
      disableLinkAfterClicks: linkData.disableLinkAfterClicks ?? undefined,
      disableLinkAfterDate: linkData.disableLinkAfterDate ?? undefined,
      activateAt: linkData.activateAt ?? null,
      tags: linkData.tags,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
      },
      utmParams: linkData.utmParams ?? undefined,
      cloaking: linkData.cloaking ?? false,
      verifiedClicksEnabled: linkData.verifiedClicksEnabled ?? false,
      geoRules: geoRulesToFormValues(geoRules),
    };
  };

  const form = useForm<z.infer<typeof updateLinkSchema>>({
    resolver: zodResolver(updateLinkSchema),
    defaultValues: getFormDefaults(link, existingGeoRules),
  });

  useEditLinkFormSync(form, { open, link, geoRules: existingGeoRules }, getFormDefaults);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      addTag(tagInput.trim());
    } else if (e.key === "ArrowDown" && userTags && userTags.length > 0) {
      setShowTagDropdown(true);
    }
  };

  const addTag = (rawTag: string) => {
    // Tags are stored lowercase; "Marketing" next to "marketing" is the same tag.
    const tagToAdd = normalizeTagName(rawTag);
    if (tagToAdd && !tags.includes(tagToAdd)) {
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
            !tags.includes(normalizeTagName(tag.name)),
        )
        .map((tag) => tag.name)
    : [];

  async function onSubmit(values: z.infer<typeof updateLinkSchema>) {
    values.tags = tags;
    const wasEnabled = link.verifiedClicksEnabled ?? false;
    const isEnabled = values.verifiedClicksEnabled ?? false;
    // Milestones are optional and plan-gated, so they are only saved when they changed, and
    // only after the link saved; the list refreshes either way.
    const save = async () => {
      values.geoRules = await geoRulesToSubmit(values.geoRules, existingGeoRules, () =>
        utils.geoRules.getByLinkId.fetch({ linkId: link.id }),
      );
      // Saved before the milestones loaded: the list holds only thresholds added since opening.
      const savedMilestones =
        existingMilestones === undefined && milestones.length > 0
          ? await utils.linkMilestone.getByLinkId.fetch({ linkId: link.id })
          : existingMilestones;
      const thresholds = (
        existingMilestones === undefined
          ? mergeMilestones(toMilestoneEntries(savedMilestones), milestones)
          : milestones
      ).map((m) => m.threshold);
      const savedThresholds = (savedMilestones ?? []).map((m) => m.threshold);
      const milestonesChanged =
        thresholds.length !== savedThresholds.length ||
        thresholds.some((threshold) => !savedThresholds.includes(threshold));
      await formUpdateMutation.mutateAsync(values);
      try {
        if (milestonesChanged) {
          await milestoneUpsertMutation.mutateAsync({ linkId: link.id, thresholds });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        // Keep the tRPC error data so a plan rejection still gets the upgrade toast.
        throw Object.assign(
          new Error(`Link saved, but milestones were not updated. ${reason}`.trim()),
          { data: error instanceof TRPCClientError ? error.data : undefined },
        );
      } finally {
        // Reopening resets from these queries, so they must reflect what was just saved.
        await Promise.all([
          utils.geoRules.getByLinkId.invalidate({ linkId: link.id }),
          utils.linkMilestone.getByLinkId.invalidate({ linkId: link.id }),
          revalidateHomepage(),
        ]);
      }
    };
    const toastId = toast.loading("Updating link...");
    save().then(
      () => {
        if (isEnabled !== wasEnabled) {
          trackEvent(
            isEnabled
              ? POSTHOG_EVENTS.VERIFIED_CLICKS_ENABLED
              : POSTHOG_EVENTS.VERIFIED_CLICKS_DISABLED,
            {
              linkId: link.id,
              plan: userSubscription?.data?.plan ?? "free",
              source: "edit",
            },
          );
        }
        onClose();
        toast.success("Link updated successfully", { id: toastId });
      },
      (error: Error & { data?: { code?: string } | null }) => {
        if (isPlanLimitError(error)) {
          toast.dismiss(toastId);
          notifyPlanLimit(
            error.message,
            linkEditLimitSource(error.message),
            requiredPlanForLimit(error.message, userSubscription?.data?.plan),
            upgradeOffer,
          );
          return;
        }
        toast.error(error.message || "Failed to update link", { id: toastId });
      },
    );
  }

  const resolvedPlan = userSubscription?.data?.plan ?? "free";
  const isUltraUser = resolvedPlan === "ultra";
  const isProOrUltraUser = resolvedPlan !== "free";

  const selectedDomain = useWatch({ control: form.control, name: "domain" });
  const movesDomain =
    !!selectedDomain && selectedDomain.toLowerCase() !== link.domain.toLowerCase();

  // Watch the URL field for debouncing
  const watchedUrl = useWatch({ control: form.control, name: "url" });
  const [debouncedUrl] = useDebounce(watchedUrl, 500);

  // Check iframe compatibility when cloaking is enabled or URL changes
  const cloakingEnabled = useWatch({ control: form.control, name: "cloaking" });
  const verifiedClicksEnabled = useWatch({ control: form.control, name: "verifiedClicksEnabled" });
  useEffect(() => {
    const controller = new AbortController();

    const runCheck = async () => {
      const url = debouncedUrl ? normalizeDestinationUrl(debouncedUrl) : null;
      if (!cloakingEnabled || !url) {
        setIframeableResult(null);
        return;
      }

      setIsCheckingIframeable(true);
      try {
        const iframeable = await checkIframeable(url, controller.signal);
        setIframeableResult(iframeable);

        if (!iframeable) {
          toast.error("This website doesn't allow cloaking. Cloaking has been disabled.");
          form.setValue("cloaking", false);
        }
      } catch (error) {
        // Ignore abort errors (component unmounted or new request started)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        log.error(
          { err: error instanceof Error ? error : String(error), linkId: link.id },
          "failed to check iframe compatibility",
        );
        setIframeableResult(false);
        form.setValue("cloaking", false);
        toast.error("Failed to verify if URL can be cloaked. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingIframeable(false);
        }
      }
    };

    void runCheck();

    return () => {
      controller.abort();
    };
  }, [cloakingEnabled, debouncedUrl, form]);

  // Radix supplies role="dialog", Escape, focus trap and focus return; the
  // portal is force-mounted so framer-motion can play the exit animation.
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            {/* Backdrop */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              />
            </DialogPrimitive.Overlay>

            {/* Drawer Panel */}
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.2 }
                    : { type: "spring", damping: 30, stiffness: 300 }
                }
                className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-neutral-200 dark:border-border bg-white dark:bg-card focus:outline-none"
              >
                {/* Header */}
                <div className="border-b border-neutral-200 dark:border-border px-6 py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-[14px] font-semibold leading-normal tracking-normal text-neutral-900 dark:text-foreground">
                        Edit Link
                      </DialogTitle>
                      <DialogDescription className="mt-0.5 break-all text-[13px] text-neutral-500 dark:text-neutral-400">
                        {link.domain}/{link.alias}
                      </DialogDescription>
                      <div className="mt-2 flex items-center gap-3 text-[12px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <IconClick
                            size={14}
                            stroke={1.5}
                            className="text-blue-600 dark:text-blue-400"
                          />
                          {link.totalClicks} clicks
                        </span>
                        <span>
                          Created{" "}
                          {link.createdAt
                            ? format(new Date(link.createdAt), "MMM d, yyyy")
                            : "Unknown"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close"
                      className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600"
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Destination URL
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                                  placeholder="https://site.com"
                                  {...field}
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Link Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                                  placeholder="My Awesome Link"
                                  maxLength={LINK_NAME_MAX_LENGTH}
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Link Alias
                              </FormLabel>
                              <FormControl>
                                <div className="flex h-9 w-full items-center overflow-hidden rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card transition-colors focus-within:ring-2 focus-within:ring-neutral-300">
                                  <LinkDomainSelect
                                    value={selectedDomain ?? link.domain}
                                    onValueChange={(domain) => selectLinkDomain(form, domain)}
                                    currentDomain={link.domain}
                                    triggerClassName="h-full w-max min-w-0 max-w-52 shrink-0 gap-1 rounded-none border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-500 shadow-none ring-0 hover:bg-transparent hover:text-neutral-900 focus:ring-0 dark:bg-transparent dark:text-neutral-400 dark:hover:bg-transparent dark:hover:text-foreground"
                                  />
                                  <div className="h-4 w-px bg-neutral-200 dark:bg-border" />
                                  <input
                                    placeholder="short-link"
                                    maxLength={LINK_ALIAS_MAX_LENGTH}
                                    className="h-full flex-1 border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-900 dark:text-foreground placeholder:text-neutral-400 focus:outline-none"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              {movesDomain && (
                                <FormDescription className="break-all text-[12px] text-neutral-400 dark:text-neutral-500">
                                  {link.domain}/{link.alias} will keep redirecting to this link.
                                </FormDescription>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="note"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Note
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                                  placeholder="Add a note to your link"
                                  maxLength={LINK_NOTE_MAX_LENGTH}
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Tags
                              </FormLabel>
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
                                            className="text-neutral-400 transition-colors hover:text-neutral-600"
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
                                          <button
                                            type="button"
                                            key={tag}
                                            className="block w-full cursor-pointer px-3 py-2 text-left text-[13px] text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              addTag(tag);
                                            }}
                                          >
                                            {tag}
                                          </button>
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

                      {/* Custom Social Media Previews */}
                      <SectionToggle
                        title="Custom Social Media Previews"
                        description="Personalize your link previews with custom metadata"
                        isOpen={isCustomMetadataOpen}
                        onToggle={() => setIsCustomMetadataOpen(!isCustomMetadataOpen)}
                        badge={!isProOrUltraUser ? <PlanBadge plan="Pro" /> : undefined}
                      >
                        <FormField
                          control={form.control}
                          name="metadata.title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Custom Title
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Custom Description
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Custom Image
                              </FormLabel>
                              <FormControl>
                                {isProOrUltraUser ? (
                                  <OgImageUploader value={field.value} onChange={field.onChange} />
                                ) : (
                                  <Input
                                    className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400"
                                    placeholder="Upgrade to Pro to add custom images"
                                    disabled
                                  />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </SectionToggle>

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
                                form.setValue("utmParams.utm_term", params.utm_term ?? undefined);
                                form.setValue(
                                  "utmParams.utm_content",
                                  params.utm_content ?? undefined,
                                );
                              }}
                            />
                          </div>
                        )}
                        <UtmParamsForm form={form} disabled={!isUltraUser} />
                      </SectionToggle>

                      {/* Link Cloaking */}
                      <SectionToggle
                        title="Link Cloaking"
                        description="Keep your short URL visible while showing destination content"
                        isOpen={isLinkCloakingOpen}
                        onToggle={() => setIsLinkCloakingOpen(!isLinkCloakingOpen)}
                        badge={!isUltraUser ? <PlanBadge plan="Ultra" /> : undefined}
                        highlighted={!!cloakingEnabled}
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
                                    <IconLoader2
                                      size={14}
                                      stroke={1.5}
                                      className="animate-spin text-neutral-400"
                                    />
                                  )}
                                  <Switch
                                    checked={field.value ?? false}
                                    onCheckedChange={field.onChange}
                                    disabled={!isUltraUser || !watchedUrl || isCheckingIframeable}
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

                        {!watchedUrl && isUltraUser && (
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

                      {/* Verified Clicks */}
                      <SectionToggle
                        title="Verified Clicks"
                        description="Tell real visitors apart from automated traffic"
                        isOpen={isVerifiedClicksOpen}
                        onToggle={() => setIsVerifiedClicksOpen(!isVerifiedClicksOpen)}
                        badge={!isProOrUltraUser ? <PlanBadge plan="Pro" /> : undefined}
                        highlighted={!!verifiedClicksEnabled}
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
                                  With this on, your analytics shows which clicks came from real
                                  visitors, not automated traffic — so you can tell real engagement
                                  apart from noise.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value ?? false}
                                  onCheckedChange={field.onChange}
                                  disabled={!isProOrUltraUser}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        {!isProOrUltraUser && (
                          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Verified clicks are available on Pro and Ultra plans.
                          </p>
                        )}
                      </SectionToggle>

                      {/* Geotargeting Rules */}
                      <GeoRulesForm
                        form={form}
                        disabled={!isProOrUltraUser}
                        maxRules={isUltraUser ? undefined : 3}
                        isUnlimited={isUltraUser}
                      />

                      {/* Click Milestone Notifications */}
                      <SectionToggle
                        title="Click Milestones"
                        description="Get notified when your link hits click thresholds"
                        isOpen={isMilestonesOpen}
                        onToggle={() => setIsMilestonesOpen(!isMilestonesOpen)}
                        badge={!isProOrUltraUser ? <PlanBadge plan="Pro" /> : undefined}
                      >
                        <MilestoneEditor
                          milestones={milestones}
                          onChange={(next) => {
                            setMilestones(next);
                            setMilestonesEdited(true);
                          }}
                          disabled={!isProOrUltraUser}
                        />
                        {!isProOrUltraUser && (
                          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            Click milestones are available on Pro and Ultra plans.{" "}
                            <UpgradeCta
                              requiredPlan="pro"
                              source="milestones"
                              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                            >
                              Upgrade to Pro
                            </UpgradeCta>
                          </p>
                        )}
                      </SectionToggle>

                      {/* Optional Settings */}
                      <SectionToggle
                        title="Optional Settings"
                        description="Configure additional options for your link"
                        isOpen={isOptionalSettingsOpen}
                        onToggle={() => setIsOptionalSettingsOpen(!isOptionalSettingsOpen)}
                      >
                        <FormField
                          control={form.control}
                          name="activateAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Go live at
                              </FormLabel>
                              {!userSubscription.isLoading && !isProOrUltraUser && (
                                <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                                  You need to be on a{" "}
                                  <UpgradeCta
                                    requiredPlan="pro"
                                    source="link_schedule"
                                    className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                                  >
                                    Pro plan
                                  </UpgradeCta>{" "}
                                  to schedule links
                                </FormDescription>
                              )}
                              <FormControl>
                                <DateTimePicker
                                  value={field.value ?? null}
                                  onChange={field.onChange}
                                  placeholder="Immediately"
                                  disabled={!isProOrUltraUser}
                                  className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50"
                                />
                              </FormControl>
                              <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                                Visitors see a &quot;not live yet&quot; page until this time. Clear
                                to go live now.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="disableLinkAfterClicks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Disable after clicks
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
                                />
                              </FormControl>
                              <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                                Deactivate after a certain number of clicks. Leave empty to never
                                disable.
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Disable after date
                              </FormLabel>
                              <FormControl>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "h-9 w-full justify-start border-neutral-200 dark:border-border text-left text-[13px] font-normal hover:bg-neutral-50 dark:hover:bg-accent/50",
                                        !field.value && "text-neutral-400",
                                      )}
                                    >
                                      <IconCalendar
                                        size={14}
                                        stroke={1.5}
                                        className="mr-2 text-neutral-400"
                                      />
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
                                Deactivate the link after a certain date.
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
                      disabled={isSaving}
                      className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
