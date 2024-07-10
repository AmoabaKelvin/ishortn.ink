"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { createLinkSchema } from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/react";

import { LinkExpirationDatePicker } from "../../_components/update-link-modal";
import { revalidateHomepage } from "../../actions/revalidate-homepage";

import type { z } from "zod";
export default function CreateLinkPage() {
  const router = useRouter();
  const [destinationURL, setDestinationURL] = useState<string | undefined>();
  const [metaData, setMetaData] = useState({
    title: "",
    description: "",
    image: "",
    favicon: "",
  });

  const userSubscription = api.subscriptions.get.useQuery();

  const form = useForm<z.infer<typeof createLinkSchema>>({
    resolver: zodResolver(createLinkSchema),
  });

  const [debouncedUrl] = useDebounce(destinationURL, 500);

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

  async function onSubmit(values: z.infer<typeof createLinkSchema>) {
    if (values.password) {
      posthog.capture("$create_link_with_password");
    }
    await formUpdateMutation.mutateAsync(values);
  }

  useEffect(() => {
    if (form.formState.errors.url ?? !form.getValues("url")) {
      return;
    }

    async function fetchMetadata() {
      const retrievedMetadata = await fetch(
        "https://meta.kelvinamoaba.com/metadata?url=" + debouncedUrl,
      );
      const metadata = (await retrievedMetadata.json()) as Metadata;

      if (metadata) {
        setMetaData(metadata);
      }
    }

    fetchMetadata().catch((error) => {
      console.error(error);
    });
  }, [debouncedUrl]);

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-11">
      <div className="md:col-span-5">
        <h2 className="text-2xl font-semibold">Create a new link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new link to share with your audience.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-5">
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
                      <Select>
                        <SelectTrigger className="w-max rounded-br-none rounded-tr-none bg-slate-100/65 dark:bg-[#0a1013]">
                          <SelectValue placeholder="ishortn.ink" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="ishortn.ink">ishortn.ink</SelectItem>
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

            {/* horizontal line with optional settings */}
            <div className="flex items-center gap-4">
              <div className="border-1 flex-grow border-t" />
              <span className="text-muted-foreground">Optional Settings</span>
              <div className="border-1 flex-grow border-t" />
            </div>

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
                    Deactivate the link after a certain number of clicks. Leave empty to never
                    disable
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
                  <FormDescription>Deactivate the link after a certain date</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              disabled={userSubscription?.data?.status !== "active"}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  {!userSubscription.isLoading && userSubscription.data?.status !== "active" && (
                    <FormDescription>
                      You need to be on a <b>pro plan</b> to create password protected links
                    </FormDescription>
                  )}

                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormDescription>
                    Set a password to protect your link. Users will be prompted to enter the
                    password before being redirected
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        <div className="h-screen border-r border-border" />
      </div>
      <div className="mt-4 flex flex-col gap-4 md:col-span-5 md:mt-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl text-foreground">How users see your link</h1>
          <p className="text-sm text-muted-foreground">
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

function LinkPreviewComponent({
  destinationURL,
  metaTitle,
  metaDescription,
  metaImage,
  favicon,
}: {
  destinationURL: string | undefined;
  metaTitle: string;
  metaDescription: string;
  metaImage: string;
  favicon: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-white/65 p-5 dark:bg-[#0a1013]">
      <div className="flex items-center font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={favicon || "https://via.placeholder.com/1200x630"}
          className="mr-2 h-6 w-6 rounded-md"
          alt="Favicon"
        />
        {metaTitle || "Title"}
      </div>
      <span className="text-sm text-foreground">{metaDescription || "Description"}</span>
      <span className="text-sm text-muted-foreground">
        {destinationURL?.replace(/(^\w+:|^)\/\//, "").split("/")[0]}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={metaImage || "https://via.placeholder.com/1200x630"}
        className="w-full rounded-lg"
        alt="Link preview"
      />
    </div>
  );
}

type Metadata = {
  title: string;
  description: string;
  image: string;
  favicon: string;
};
