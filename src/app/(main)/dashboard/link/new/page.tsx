"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Gem } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
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

import { LinkExpirationDatePicker } from "../../_components/single-link/update-link-modal";
import { revalidateHomepage } from "../../actions/revalidate-homepage";
import { LinkPreviewComponent } from "./link-preview";

import type { CustomDomain } from "@/server/db/schema";
import type { z } from "zod";
export default function CreateLinkPage() {
  const router = useRouter();
  const [destinationURL, setDestinationURL] = useState<string | undefined>();
  const [userDomains, setUserDomains] = useState<CustomDomain[]>([]);
  const [isCustomMetadataOpen, setIsCustomMetadataOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);
  const [metaData, setMetaData] = useState({
    title: "",
    description: "",
    image: "",
    favicon: "",
  });

  const userSubscription = api.subscriptions.get.useQuery();
  const customDomainsQuery = api.customDomain.list.useQuery();

  const form = useForm<z.infer<typeof createLinkSchema>>({
    resolver: zodResolver(createLinkSchema),
  });

  const [debouncedUrl] = useDebounce(destinationURL, 500);
  const [debouncedAlias] = useDebounce(form.watch("alias"), 500);
  const selectedDomain = form.watch("domain") ?? "ishortn.ink";

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

  async function onSubmit(values: z.infer<typeof createLinkSchema>) {
    if (values.password) {
      posthog.capture("$create_link_with_password");
    }
    await formUpdateMutation.mutateAsync(values);
  }

  useEffect(() => {
    if (customDomainsQuery.data) {
      setUserDomains(customDomainsQuery.data);
    }
  }, [customDomainsQuery.data]);

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
  }

  useEffect(() => {
    if ((form.formState.errors.url ?? !form.getValues("url")) || !debouncedUrl) {
      return;
    }
    void fetchMetadata(debouncedUrl);
  }, [debouncedUrl]);

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      <div className="md:col-span-5">
        <h2 className="text-2xl font-semibold text-gray-900">Create a new link</h2>
        <p className="mt-1 text-sm text-gray-500">Create a new link to share with your audience.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-5">
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
                              <SelectItem value="ishortn.ink">ishortn.ink</SelectItem>
                              {userDomains.length > 0 && (
                                <>
                                  {userDomains.map((domain) => (
                                    <SelectItem key={domain.id} value={domain.domain!}>
                                      {domain.domain}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="short-link"
                          className="h-10 flex-grow rounded-bl-none rounded-tl-none"
                          {...field}
                        />
                      </section>
                    </FormControl>
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
                    {userSubscription?.data?.subscriptions?.status !== "active" && (
                      <span className="max-w-fit whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-px text-xs font-medium capitalize text-gray-800 transition-all hover:bg-gray-200">
                        <div className="flex items-center space-x-1">
                          <Gem className="h-4 w-4 text-slate-500" />
                          <p className="uppercase">Pro</p>
                        </div>
                      </span>
                    )}
                  </p>
                  <span className="text-sm text-gray-500">
                    Personalize your link previews with custom metadata settings.
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
                                  setMetaData({ ...metaData, title: e.target.value });
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
                                  setMetaData({ ...metaData, description: e.target.value });
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
                                  setMetaData({ ...metaData, image: e.target.value });
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
                    Access additional configuration options for further customization.
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
                            <FormLabel>Disable after date</FormLabel>
                            <FormControl>
                              <LinkExpirationDatePicker setSeletectedDate={field.onChange} />
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
                        disabled={userSubscription?.data?.subscriptions?.status !== "active"}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            {!userSubscription.isLoading &&
                              userSubscription.data?.subscriptions?.status !== "active" && (
                                <FormDescription>
                                  You need to be on a <b>pro plan</b> to create password protected
                                  links
                                </FormDescription>
                              )}

                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormDescription>
                              Set a password to protect your link. Users will be prompted to enter
                              the password before being redirected
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
