"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarIcon, ChevronDown, Gem, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
import { UtmParamsForm } from "@/app/(main)/dashboard/_components/utm-params-form";
import { UtmTemplateSelector } from "@/app/(main)/dashboard/_components/utm-template-selector";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateLinkSchema } from "@/server/api/routers/link/link.input";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";
import type { z } from "zod";

type LinkEditModalProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function UpdateLinkModal({ link, open, setOpen }: LinkEditModalProps) {
  const [tags, setTags] = useState<string[]>((link.tags as string[]) || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isUtmParamsOpen, setIsUtmParamsOpen] = useState(false);
  const [isOptionalSettingsOpen, setIsOptionalSettingsOpen] = useState(false);

  // Fetch user's existing tags
  const { data: userTags } = api.tag.list.useQuery();
  const userSubscription = api.subscriptions.get.useQuery();

  const formUpdateMutation = api.link.update.useMutation({
    onSuccess: async () => {
      await revalidateHomepage();
      toast.success("Link updated successfully");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<z.infer<Omit<typeof updateLinkSchema, "id">>>({
    resolver: zodResolver(updateLinkSchema),
    defaultValues: {
      id: link.id,
      name: link.name!,
      url: link.url!,
      alias: link.alias!,
      note: link.note ?? undefined,
      disableLinkAfterClicks: link.disableLinkAfterClicks ?? undefined,
      disableLinkAfterDate: link.disableLinkAfterDate ?? undefined,
      tags: (link.tags as string[]) || [],
      utmParams: (link.utmParams as {
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        utm_term?: string;
        utm_content?: string;
      }) ?? undefined,
    },
  });
  form.setValue("id", link.id);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      addTag(tagInput.trim());
    } else if (e.key === "ArrowDown" && userTags && userTags.length > 0) {
      // Show dropdown on arrow down
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

  // Filter tags based on input
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

  async function onSubmit(
    values: z.infer<Omit<typeof updateLinkSchema, "id">>
  ) {
    values.tags = tags;
    toast.promise(formUpdateMutation.mutateAsync(values), {
      loading: "Updating link...",
      success: "Link updated successfully",
      error: "Failed to update link",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={`sm:max-w-[425px] max-h-[90vh] overflow-y-auto ${satoshi.className}`}
      >
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>Make changes to your link here</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information Section */}
            <div className="rounded-lg border border-gray-200 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsBasicInfoOpen(!isBasicInfoOpen)}
              >
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">
                    Basic Information
                  </span>
                  <span className="text-sm text-gray-500">
                    Edit the main details of your link
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 transform transition-transform ${
                    isBasicInfoOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {isBasicInfoOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="mt-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Destination URL</FormLabel>
                            <FormControl>
                              <Input
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
                                <Select>
                                  <SelectTrigger className="w-max rounded-br-none rounded-tr-none bg-slate-50">
                                    <SelectValue placeholder="ishortn.ink" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="ishortn.ink">
                                        ishortn.ink
                                      </SelectItem>
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

                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Add a note to your link"
                                {...field}
                              />
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

            {/* Tags Section */}
            <div className="rounded-lg border border-gray-200 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsTagsOpen(!isTagsOpen)}
              >
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">Tags</span>
                  <span className="text-sm text-gray-500">
                    Organize your link with tags
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 transform transition-transform ${
                    isTagsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {isTagsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="tags"
                        render={() => (
                          <FormItem>
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
                                      // Delay hiding dropdown to allow for clicks
                                      setTimeout(
                                        () => setShowTagDropdown(false),
                                        200
                                      );
                                    }}
                                    onFocus={() => {
                                      setShowTagDropdown(true);
                                    }}
                                  />

                                  {/* Tag dropdown */}
                                  {showTagDropdown &&
                                    filteredTags.length > 0 && (
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
                              Add tags to categorize your links. Press Enter to
                              add a tag or select from existing tags.
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              className="mt-10 w-full"
              onClick={form.handleSubmit(onSubmit)}
            >
              Submit
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type LinkExpirationDatePickerProps = {
  setSeletectedDate: (date: Date) => void;
};

export function LinkExpirationDatePicker({
  setSeletectedDate,
}: LinkExpirationDatePickerProps) {
  const [date, setDate] = useState<Date>();

  const handleSelect = (date: Date) => {
    setDate(date);
    setSeletectedDate(date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(date) => handleSelect(date!)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
