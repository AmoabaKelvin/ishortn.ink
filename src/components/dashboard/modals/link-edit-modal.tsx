import { Prisma } from "@prisma/client";
import { useFormik } from "formik";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateLink } from "@/actions/link-actions";
import { LinkExpirationDatePicker } from "@/components/forms/dashboard/links/date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type LinkEditModalProps = {
  link: Prisma.LinkUpdateInput;
  open: boolean;
  setOpen: (open: boolean) => void;
  linkId: number;
};

export function LinkEditModal({
  link,
  open,
  setOpen,
  linkId,
}: LinkEditModalProps) {
  const [loading, startTransition] = useTransition();
  const formik = useFormik({
    initialValues: {
      ...link,
    },
    onSubmit: async (values) => {
      startTransition(async () => {
        const response = await updateLink(values, linkId);
        if (response && "id" in response) {
          setOpen(false);
          toast.success("Your link has been updated.");
        }
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>Make changes to your link here</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="Destination URL">Destination URL</Label>
              <Input
                id="Destination URL"
                placeholder="https://example.com"
                type="url"
                className={`${formik.errors.url && "border-red-500"}`}
                // onChange={(e) => {
                //   formik.setFieldValue("url", e.target.value);
                // }}
                {...formik.getFieldProps("url")}
              />
              <span className="text-sm text-red-500">{formik.errors.url}</span>
            </div>

            {/* Link alias, show the ishortn.ink in a disabled select and the input right next to it*/}
            <div className="flex flex-col gap-2">
              <Label htmlFor="Link alias">Link alias</Label>
              <div className="flex">
                <Select>
                  <SelectTrigger className="rounded-tr-none rounded-br-none w-max bg-slate-50">
                    <SelectValue placeholder="ishortn.ink" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ishortn.ink">ishortn.ink</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  id="Link alias"
                  placeholder="example"
                  className={cn(
                    "flex-grow rounded-tl-none rounded-bl-none",
                    formik.errors.alias && "border-red-500",
                  )}
                  {...formik.getFieldProps("alias")}
                />
              </div>
            </div>

            {/* Optional settings */}
            {/* Horizontal line with the text Optional Settings in the middle */}
            <div className="flex items-center gap-4 mt-3 mb-3">
              <div className="flex-grow border-t border-gray-200" />
              <span className="text-gray-500">Optional Settings</span>
              <div className="flex-grow border-t border-gray-200" />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="Link expiration">Link expiration</Label>
                <span className="text-sm text-gray-500">
                  Deactivate the link after a certain date
                </span>
              </div>
              <LinkExpirationDatePicker
                setSeletectedDate={(date) => {
                  formik.setFieldValue("disableLinkAfterDate", date);
                }}
              />
            </div>

            {/* Deactivate after Number of clicks */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="Deactivate after">Deactivate after</Label>
                <span className="text-sm text-gray-500">
                  Deactivate the link after a certain number of clicks
                </span>
              </div>
              <Input
                id="Deactivate after"
                placeholder="Leave empty for no limit"
                type="number"
                min={0}
                className={cn(
                  formik.errors.disableLinkAfterClicks && "border-red-500",
                )}
                {...formik.getFieldProps("disableLinkAfterClicks")}
              />
              <span className="text-sm text-red-500">
                {formik.errors.disableLinkAfterClicks}
              </span>
            </div>

            {/* Password protection */}
            {/* <div className="flex flex-col gap-2">
            <Label htmlFor="Password protection">Password protection</Label>
            <Input
              id="Password protection"
              placeholder="Never"
              type="password"
            />
          </div> */}
            <Button className="mt-4" type="submit" disabled={loading}>
              Save changes
              {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
