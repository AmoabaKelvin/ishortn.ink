"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Gem,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
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
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { createLinkSchema } from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/react";

import { LinkExpirationDatePicker } from "../../_components/links/link-card/update-modal";
import { UtmParamsForm } from "../../_components/utm-params-form";
import { UtmTemplateSelector } from "../../_components/utm-template-selector";
import { revalidateHomepage } from "../../revalidate-homepage";

import { LinkPreviewComponent } from "./_components/link-preview";
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
  const [destinationURL, setDestinationURL] = useState<string | undefined>();
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
  });

  const [debouncedUrl] = useDebounce(destinationURL, 500);
  const [debouncedAlias] = useDebounce(form.watch("alias"), 500);
  const selectedDomain = form.watch("domain") ?? "ishortn.ink";

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
      newIndex =
        (currentAliasIndex - 1 + generatedAliases.length) %
        generatedAliases.length;
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

    let currentMetadata = metaData;
    if (!currentMetadata.title && !currentMetadata.description) {
      const newMetadata = (await fetchMetadata(url)) as unknown as MetaData;
      if (newMetadata) {
        currentMetadata = newMetadata;
      } else {
        toast.error("Failed to fetch metadata. Please try again.");
        return;
      }
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
    }
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
            (tagInput === "" ||
              tag.name.toLowerCase().includes(tagInput.toLowerCase())) &&
            !tags.includes(tag.name)
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
      domain: values.domain || "ishortn.ink",
    });
  }

  useEffect(() => {
    if (customDomainsQuery.data) {
      setUserDomains(customDomainsQuery.data);
    }
  }, [customDomainsQuery.data]);

  // Fetch ishortn.ink metadata on initial load
  useEffect(() => {
    if (isInitialLoad) {
      fetchMetadataInfo("https://ishortn.ink").then((metadata) => {
        setMetaData(metadata);
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

  async function fetchMetadata(url: string) {
    if (!url) return;
    const metadata = await fetchMetadataInfo(url);
    setMetaData(metadata);
    setGeneratedAliases([]);
    form.setValue("alias", "");

    if (userSubscription?.data?.subscriptions?.status === "active") {
      generateAliasMutation.mutate({
        url: form.getValues("url"),
        title: metadata.title,
        description: metadata.description,
      });
    }
  }

  useEffect(() => {
    if (
      (form.formState.errors.url ?? !form.getValues("url")) ||
      !debouncedUrl
    ) {
      return;
    }
    void fetchMetadata(debouncedUrl);
  }, [debouncedUrl]);

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      <div className="md:col-span-5">
        <h2 className="text-2xl font-semibold text-gray-900">
          Create a new link
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Create a new link to share with your audience.
        </p>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-5 space-y-5"
          >
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Destination URL <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://site.com"
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
                      <section className="flex items-center">
                        <Select
                          onValueChange={(value) => {
                            form.setValue("domain", value);
                          }}
                        >
                          <SelectTrigger className="w-max rounded-br-none rounded-tr-none bg-slate-50">
                            <SelectValue placeholder="ishortn.ink" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="ishortn.ink">
                                ishortn.ink
                              </SelectItem>
                              {userDomains.length > 0 &&
                                userDomains.map((domain) => (
                                  <SelectItem
                                    key={domain.id}
                                    value={domain.domain!}
                                  >
                                    {domain.domain}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <div className="relative flex-grow">
                          <Input
                            placeholder="short-link"
                            className="h-10 flex-grow rounded-bl-none rounded-tl-none"
                            {...field}
                          />

                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {generateAliasMutation.isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            ) : generatedAliases.length > 0 ? (
                              <div className="flex flex-col">
                                <ChevronUp
                                  className="h-4 w-4 cursor-pointer text-gray-500 hover:text-gray-700"
                                  onClick={() => cycleAlias("up")}
                                />
                                <ChevronDown
                                  className="h-4 w-4 cursor-pointer text-gray-500 hover:text-gray-700"
                                  onClick={() => cycleAlias("down")}
                                />
                              </div>
                            ) : userSubscription?.data?.subscriptions
                                ?.status !== "active" ? (
                              <UpgradeToProAIButtonTooltip />
                            ) : (
                              <Sparkles
                                className="h-4 w-4 text-gray-500"
                                onClick={handleRegenerateClick}
                              />
                            )}
                          </div>
                        </div>
                      </section>
                    </FormControl>
                    <AnimatePresence>
                      {generatedAliases.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <FormDescription className="flex justify-between">
                            <motion.span key={currentAliasIndex}>
                              Suggestion {currentAliasIndex + 1} of{" "}
                              {generatedAliases.length}
                            </motion.span>
                            <motion.span
                              className="cursor-pointer"
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

              {/* form field for note */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Add a note to your link</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={() => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {tags.map((tag) => (
                            <div
                              key={tag}
                              className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 rounded-md"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
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
                            onFocus={() => {
                              setShowTagDropdown(true);
                            }}
                          />

                          {/* Tag dropdown */}
                          {showTagDropdown && filteredTags.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredTags.map((tag) => (
                                <div
                                  key={tag}
                                  className="px-4 py-2 cursor-pointer hover:bg-gray-100"
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
                    <FormDescription>
                      Add tags to categorize your links. Press Enter to add a
                      tag or select from existing tags.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Custom Metadata Section */}
            <div className="rounded-lg border border-gray-200 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsCustomMetadataOpen(!isCustomMetadataOpen)}
              >
                <div className="flex flex-col">
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    Custom Social Media Previews
                    {userSubscription?.data?.subscriptions?.status !==
                      "active" && (
                      <span className="max-w-fit whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800 transition-all hover:bg-gray-200">
                        <span className="flex items-center space-x-1">
                          <Gem className="h-4 w-4 text-slate-500" />
                          <p className="uppercase">Pro</p>
                        </span>
                      </span>
                    )}
                  </p>
                  <span className="text-sm text-gray-500">
                    Personalize your link previews with custom metadata
                    settings.
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
                                onChange={(e) => {
                                  field.onChange(e);
                                  setMetaData({
                                    ...metaData,
                                    title: e.target.value,
                                  });
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
                            <FormLabel>Custom Description</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Custom description for your link"
                                onChange={(e) => {
                                  field.onChange(e);
                                  setMetaData({
                                    ...metaData,
                                    description: e.target.value,
                                  });
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
                            <FormLabel>Custom Image URL</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="https://example.com/image.jpg"
                                onChange={(e) => {
                                  field.onChange(e);
                                  setMetaData({
                                    ...metaData,
                                    image: e.target.value,
                                  });
                                }}
                              />
                            </FormControl>
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
                    {userSubscription?.data?.subscriptions?.plan !== "ultra" && (
                      <span className="max-w-fit whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800 transition-all hover:bg-gray-200">
                        <span className="flex items-center space-x-1">
                          <Gem className="h-4 w-4 text-slate-500" />
                          <p className="uppercase">Ultra</p>
                        </span>
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
                      {userSubscription?.data?.subscriptions?.plan === "ultra" && (
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
                        disabled={userSubscription?.data?.subscriptions?.plan !== "ultra"}
                      />
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
                onClick={() =>
                  setIsOptionalSettingsOpen(!isOptionalSettingsOpen)
                }
              >
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">
                    Optional Settings
                  </span>
                  <span className="text-sm text-gray-500">
                    Access additional configuration options for further
                    customization.
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
                      {/* Move the existing optional settings fields here */}
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
                              Deactivate the link after a certain number of
                              clicks. Leave empty to never disable
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
                              <LinkExpirationDatePicker
                                setSeletectedDate={field.onChange}
                              />
                            </FormControl>
                            <FormDescription>
                              Deactivate the link after a certain date
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        disabled={
                          userSubscription?.data?.subscriptions?.status !==
                          "active"
                        }
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            {!userSubscription.isLoading &&
                              userSubscription.data?.subscriptions?.status !==
                                "active" && (
                                <FormDescription>
                                  You need to be on a <b>pro plan</b> to create
                                  password protected links
                                </FormDescription>
                              )}

                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormDescription>
                              Set a password to protect your link. Users will be
                              prompted to enter the password before being
                              redirected
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

            <Button
              type="submit"
              className="mt-10 w-full"
              onClick={form.handleSubmit(onSubmit)}
              disabled={formUpdateMutation.isLoading}
            >
              Submit
            </Button>
          </form>
        </Form>
      </div>
      <div className="hidden items-center justify-center md:flex">
        <div className="h-screen border-r border-gray-200" />
      </div>
      <div className="mt-4 flex flex-col gap-4 md:col-span-5 md:mt-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">How users see your link</h1>
          <p className="text-sm text-gray-500">
            This is how your link will be displayed to users on social platforms
          </p>
        </div>
        <LinkPreviewComponent
          destinationURL={form.getValues("url")}
          metaTitle={metaData.title}
          metaDescription={metaData.description}
          metaImage={metaData.image}
          favicon={metaData.favicon}
        />
      </div>
    </section>
  );
}
