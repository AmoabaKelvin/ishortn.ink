"use client";

import { Button } from "@/components/ui/button";
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
import { useEffect, useState, useTransition } from "react";
import * as Yup from "yup";

import { Loader2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import { LinkExpirationDatePicker } from "./date-picker";

import { Prisma } from "@prisma/client";

import { createLink } from "@/app/dashboard/_actions/link-actions";
import { cn, fullUrlRegex } from "@/lib/utils";
import { useFormik } from "formik";

import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

type LinkEditFormProps = Prisma.LinkCreateInput;

const LinkEditForm = () => {
  const [loading, startTransition] = useTransition();
  const router = useRouter();
  const [destinationURL, setDestinationURL] = useState<string>("");
  const { toast } = useToast();
  const [metaData, setMetaData] = useState<Record<string, string>>({
    title: "",
    description: "",
    image: "",
  });

  const formik = useFormik<LinkEditFormProps>({
    initialValues: {
      url: "",
      alias: "",
      disableLinkAfterClicks: 0,
      disableLinkAfterDate: null,
    },
    validationSchema: Yup.object({
      url: Yup.string()
        .required("Destination URL is required")
        .matches(fullUrlRegex, "Please enter a valid URL"),
      alias: Yup.string().matches(
        /^[a-zA-Z0-9-_]+$/,
        "Only letters, numbers, dashes and underscores are allowed",
      ),
      disableLinkAfterClicks: Yup.number().optional(),
    }),
    onSubmit: async (values) => {
      console.log(values);
      startTransition(async () => {
        const response = await createLink(values);

        if (response && "error" in response) {
          toast({
            title: "Uh oh!",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Link created successfully",
          });
          router.push("/dashboard/");
        }
      });
    },
  });

  const [debouncedDestinationURL] = useDebounce(destinationURL, 500);

  useEffect(() => {
    const getOGData = async () => {
      const response = await fetch(
        `https://api.dub.co/metatags?url=${debouncedDestinationURL}`,
      );
      const data = await response.json();
      setMetaData(data);
    };

    if (debouncedDestinationURL) {
      if (fullUrlRegex.test(debouncedDestinationURL)) {
        getOGData();
      }
    }
  }, [debouncedDestinationURL, formik.errors]);

  return (
    <section className="grid grid-cols-1 gap-5 mt-6 md:grid-cols-11">
      <div className="flex flex-col col-span-5 gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Create your Link</h1>
          <p className="text-sm text-gray-500">
            Create your link and customize it with optional settings
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="Destination URL">Destination URL</Label>
            <Input
              id="Destination URL"
              placeholder="https://example.com"
              type="url"
              className={`${formik.errors.url && "border-red-500"}`}
              onChange={(e) => {
                setDestinationURL(e.target.value);
                formik.setFieldValue("url", e.target.value);
              }}
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
              {...formik.getFieldProps("disableLinkAfterClicks")}
            />
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
          <Button className="mt-8" disabled={loading} type="submit">
            Create Link
            {loading && <Loader2 className="ml-2 animate-spin" />}
          </Button>
        </form>
      </div>
      <div className="items-center justify-center hidden md:flex">
        <div className="h-screen border-r border-gray-200" />
      </div>
      <div className="flex flex-col gap-4 mt-4 md:col-span-5 md:mt-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">How users see your link</h1>
          <p className="text-sm text-gray-500">
            This is how your link will be displayed to users on social platforms
          </p>
        </div>

        {/* OG Preview cards for twitter, facebook and linkedin */}
        <div className="flex flex-col gap-4">
          <div className="border rounded-lg">
            <div className="flex flex-col p-5 bg-white rounded-lg">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-500">
                  {/* Get only the actual url, like devshare.dev from https://www.devshare.dev */}
                  {destinationURL &&
                    /^(https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+[/#?]?.*$/.test(
                      destinationURL,
                    ) &&
                    new URL(destinationURL).hostname.replace("www.", "")}
                </span>
                <span className="text-lg font-semibold">
                  {metaData.title || "Title"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm">
                  {metaData.description || "Description"}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={metaData.image || "https://via.placeholder.com/1200x630"}
                alt="OG Image"
                className="w-full mt-4 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LinkEditForm;
