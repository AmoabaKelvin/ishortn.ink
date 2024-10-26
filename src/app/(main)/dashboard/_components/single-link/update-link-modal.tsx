"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateLinkSchema } from "@/server/api/routers/link/link.input";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../../actions/revalidate-homepage";

import type { RouterOutputs } from "@/trpc/shared";
import type { z } from "zod";
type LinkEditModalProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function UpdateLinkModal({
  link,
  open,
  setOpen,
}: LinkEditModalProps) {
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
    },
  });
  form.setValue("id", link.id);

  async function onSubmit(
    values: z.infer<Omit<typeof updateLinkSchema, "id">>
  ) {
    toast.promise(formUpdateMutation.mutateAsync(values), {
      loading: "Updating link...",
      success: "Link updated successfully",
      error: "Failed to update link",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={`sm:max-w-[425px] ${satoshi.className}`}>
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>Make changes to your link here</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Input placeholder="Add a note to your link" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* horizontal line with optional settings */}
            <div className="flex items-center gap-4">
              <div className="flex-grow border-t border-gray-200" />
              <span className="text-gray-500">Optional Settings</span>
              <div className="flex-grow border-t border-gray-200" />
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
