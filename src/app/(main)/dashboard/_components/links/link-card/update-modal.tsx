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
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>Update your link settings</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-3">
              {/* Basic Information Section */}
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsBasicInfoOpen(!isBasicInfoOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Basic Information</span>
                    <span className="text-xs text-muted-foreground">
                      Main details of your link
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
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
                      <div className="border-t border-border p-4 space-y-4">
                        <FormField
                          control={form.control}
                          name="url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Destination URL
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://site.com"
                                  className="h-10"
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
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Link Name
                                <span className="ml-1.5 text-muted-foreground/60 lowercase tracking-normal font-normal">
                                  optional
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="My Awesome Link"
                                  className="h-10"
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
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Alias
                              </FormLabel>
                              <FormControl>
                                <section className="flex items-center">
                                  <Select>
                                    <SelectTrigger className="w-max rounded-r-none border-r-0 bg-muted/50 h-10">
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
                                    className="h-10 flex-grow rounded-l-none"
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
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Note
                                <span className="ml-1.5 text-muted-foreground/60 lowercase tracking-normal font-normal">
                                  optional
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Add a note"
                                  className="h-10"
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
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsTagsOpen(!isTagsOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Tags</span>
                    <span className="text-xs text-muted-foreground">
                      Organize with tags
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
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
                      <div className="border-t border-border p-4">
                        <FormField
                          control={form.control}
                          name="tags"
                          render={() => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                      {tags.map((tag) => (
                                        <div
                                          key={tag}
                                          className="flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-md"
                                        >
                                          <span>{tag}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeTag(tag)}
                                            className="text-muted-foreground hover:text-foreground"
                                          >
                                            <X size={12} />
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
                                      className="h-10"
                                    />
                                    {showTagDropdown &&
                                      filteredTags.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                                          {filteredTags.map((tag) => (
                                            <div
                                              key={tag}
                                              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
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
                              <FormDescription className="text-xs">
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
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setIsUtmParamsOpen(!isUtmParamsOpen)}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">UTM Parameters</span>
                      {userSubscription?.data?.subscriptions?.plan !==
                        "ultra" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Gem className="h-3 w-3" />
                          ULTRA
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Campaign tracking
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
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
                      <div className="border-t border-border p-4 space-y-3">
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
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() =>
                    setIsOptionalSettingsOpen(!isOptionalSettingsOpen)
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Advanced Settings</span>
                    <span className="text-xs text-muted-foreground">
                      Expiration options
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
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
                      <div className="border-t border-border p-4 space-y-4">
                        <FormField
                          control={form.control}
                          name="disableLinkAfterClicks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Disable After Clicks
                              </FormLabel>
                              <FormControl>
                                <Input {...field} type="number" className="h-10" />
                              </FormControl>
                              <FormDescription className="text-xs">
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
                              <FormLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formUpdateMutation.isLoading}
                className="h-9"
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
            "w-full justify-start text-left font-normal h-10",
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
