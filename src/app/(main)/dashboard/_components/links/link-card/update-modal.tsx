"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconCalendar,
  IconChevronDown,
  IconDiamond,
  IconX,
} from "@tabler/icons-react";
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { DEFAULT_PLATFORM_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { cn } from "@/lib/utils";
import { updateLinkSchema } from "@/server/api/routers/link/link.input";
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
      utmParams:
        (link.utmParams as {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">Edit Link</DialogTitle>
          <DialogDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">Update your link settings</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-3">
              {/* Basic Information Section */}
              <div className="rounded-lg border border-neutral-200 dark:border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsBasicInfoOpen(!isBasicInfoOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">Basic Information</span>
                    <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Main details of your link
                    </span>
                  </div>
                  <IconChevronDown
                    size={16}
                    stroke={1.5}
                    className={cn(
                      "shrink-0 text-neutral-400 transition-transform duration-200",
                      isBasicInfoOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isBasicInfoOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-neutral-200 dark:border-border p-4">
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
                                  placeholder="https://site.com"
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
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
                                <span className="ml-1.5 text-[12px] font-normal text-neutral-400">
                                  optional
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="My Awesome Link"
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                                  {...field}
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Alias
                              </FormLabel>
                              <FormControl>
                                <section className="flex items-center">
                                  <Select>
                                    <SelectTrigger className="h-9 w-max rounded-r-none border-r-0 border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 text-[13px]">
                                      <SelectValue placeholder={DEFAULT_PLATFORM_DOMAIN} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {PLATFORM_DOMAINS.map((domain) => (
                                          <SelectItem key={domain} value={domain}>
                                            {domain}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    placeholder="short-link"
                                    className="h-9 flex-grow rounded-l-none border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
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
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Note
                                <span className="ml-1.5 text-[12px] font-normal text-neutral-400">
                                  optional
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Add a note"
                                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
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
              <div className="rounded-lg border border-neutral-200 dark:border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsTagsOpen(!isTagsOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">Tags</span>
                    <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Organize with tags
                    </span>
                  </div>
                  <IconChevronDown
                    size={16}
                    stroke={1.5}
                    className={cn(
                      "shrink-0 text-neutral-400 transition-transform duration-200",
                      isTagsOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isTagsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-neutral-200 dark:border-border p-4">
                        <FormField
                          control={form.control}
                          name="tags"
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  {tags.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-1.5">
                                      {tags.map((tag) => (
                                        <div
                                          key={tag}
                                          className="flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-muted px-2 py-1 text-[12px] text-neutral-600 dark:text-neutral-400"
                                        >
                                          <span>{tag}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeTag(tag)}
                                            className="text-neutral-400 hover:text-neutral-600"
                                          >
                                            <IconX size={12} stroke={1.5} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="relative">
                                    <Input
                                      placeholder="Add tags (press Enter)"
                                      value={tagInput}
                                      onChange={(e) => {
                                        setTagInput(e.target.value);
                                        setShowTagDropdown(true);
                                      }}
                                      onKeyDown={handleTagKeyDown}
                                      onBlur={() => {
                                        setTimeout(
                                          () => setShowTagDropdown(false),
                                          200
                                        );
                                      }}
                                      onFocus={() => setShowTagDropdown(true)}
                                      className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                                    />
                                    {showTagDropdown &&
                                      filteredTags.length > 0 && (
                                        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card shadow-md">
                                          {filteredTags.map((tag) => (
                                            <div
                                              key={tag}
                                              className="cursor-pointer px-3 py-2 text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50"
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
                                Press Enter to add a tag
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
              <div className="rounded-lg border border-neutral-200 dark:border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsUtmParamsOpen(!isUtmParamsOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">UTM Parameters</span>
                      {userSubscription?.data?.subscriptions?.plan !==
                        "ultra" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-px text-[11px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
                          <IconDiamond size={12} stroke={1.5} className="text-neutral-400" />
                          Ultra
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Campaign tracking
                    </span>
                  </div>
                  <IconChevronDown
                    size={16}
                    stroke={1.5}
                    className={cn(
                      "shrink-0 text-neutral-400 transition-transform duration-200",
                      isUtmParamsOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isUtmParamsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-neutral-200 dark:border-border p-4">
                        {userSubscription?.data?.subscriptions?.plan ===
                          "ultra" && (
                          <div className="flex justify-end">
                            <UtmTemplateSelector
                              onSelect={(params) => {
                                form.setValue(
                                  "utmParams.utm_source",
                                  params.utm_source ?? undefined
                                );
                                form.setValue(
                                  "utmParams.utm_medium",
                                  params.utm_medium ?? undefined
                                );
                                form.setValue(
                                  "utmParams.utm_campaign",
                                  params.utm_campaign ?? undefined
                                );
                                form.setValue(
                                  "utmParams.utm_term",
                                  params.utm_term ?? undefined
                                );
                                form.setValue(
                                  "utmParams.utm_content",
                                  params.utm_content ?? undefined
                                );
                              }}
                            />
                          </div>
                        )}
                        <UtmParamsForm
                          form={form}
                          disabled={
                            userSubscription?.data?.subscriptions?.plan !==
                            "ultra"
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Optional Settings Section */}
              <div className="rounded-lg border border-neutral-200 dark:border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() =>
                    setIsOptionalSettingsOpen(!isOptionalSettingsOpen)
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">Advanced Settings</span>
                    <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                      Expiration options
                    </span>
                  </div>
                  <IconChevronDown
                    size={16}
                    stroke={1.5}
                    className={cn(
                      "shrink-0 text-neutral-400 transition-transform duration-200",
                      isOptionalSettingsOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isOptionalSettingsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-neutral-200 dark:border-border p-4">
                        <FormField
                          control={form.control}
                          name="disableLinkAfterClicks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                                Disable After Clicks
                              </FormLabel>
                              <FormControl>
                                <Input {...field} type="number" className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]" />
                              </FormControl>
                              <FormDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                                Leave empty to never disable
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
                                Disable After Date
                              </FormLabel>
                              <FormControl>
                                <LinkExpirationDatePicker
                                  setSeletectedDate={field.onChange}
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
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 border-neutral-200 dark:border-border text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formUpdateMutation.isLoading}
                className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
              >
                {formUpdateMutation.isLoading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
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
          variant="outline"
          className={cn(
            "h-9 w-full justify-start border-neutral-200 dark:border-border text-left text-[13px] font-normal",
            !date && "text-neutral-400"
          )}
        >
          <IconCalendar size={14} stroke={1.5} className="mr-2 text-neutral-400" />
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
