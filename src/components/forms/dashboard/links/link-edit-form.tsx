"use client";

import { Prisma } from "@prisma/client";
import { useFormik } from "formik";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import * as Yup from "yup";

import { createLink, quickLinkShorten } from "@/actions/link-actions";
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
import { cn, fullUrlRegex } from "@/lib/utils";

import { LinkExpirationDatePicker } from "./date-picker";
import LinkPreviewComponent from "./link-preview-component";

type LinkEditFormProps = Prisma.LinkCreateInput;

const LinkEditForm = () => {
  const [loading, startTransition] = useTransition();
  const router = useRouter();
  const [destinationURL, setDestinationURL] = useState<string>("");
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
        "Only letters, numbers, dashes and underscores are allowed"
      ),
      disableLinkAfterClicks: Yup.number().min(
        0,
        "Number of clicks must be greater than or equal to 0"
      ),
    }),
    onSubmit: async (values) => {
      console.log(values);
      startTransition(async () => {
        // if disableLinkAfterClicks is 0, set it to null
        if (values.disableLinkAfterClicks === 0) {
          values.disableLinkAfterClicks = null;
        }
        const response = await createLink(values);

        if (response && "error" in response) {
          toast.error("Uh oh!", {
            description: response.error,
          });
        } else {
          toast.success("Link created successfully");
          router.push("/dashboard/");
        }
      });
    },
  });

  const [debouncedDestinationURL] = useDebounce(destinationURL, 500);

  useEffect(() => {
    const getOGData = async () => {
      const response = await fetch(
        `https://api.dub.co/metatags?url=${debouncedDestinationURL}`
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

  interface CSVRow {
    links: string;
  }
  function isURL(str: string): boolean {
    const urlRegex = /^(?:https?|ftp):\/\/(?:\w+\.?)+/i;
    return urlRegex.test(str);
  }
  const handleCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log(file.type);
      if (file.type === "text/csv") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const csvText = e.target?.result as string;
          const parsedData = Papa.parse<CSVRow>(csvText, { header: true });
          const linksColumn = parsedData.data.map((row: CSVRow) => row.links);
          console.log(linksColumn);
          // linksCol is a array of all links, now shorten it
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
          startTransition(async () => {
            try {
              const shortenPromises = linksColumn.map(async (link) => {
                if (!isURL(link)) {
                  toast.error(`Invalid URL: ${link}`);
                  return false;
                }
                const response = await quickLinkShorten(link);
                if (response && "id" in response) {
                  return true;
                } else {
                  throw new Error(
                    "An error occurred while shortening your link."
                  );
                }
              });

              await Promise.all(shortenPromises);

              toast.success("Your links have been shortened.");
              router.push("/dashboard/");
            } catch (error) {
              const errorMessage = (error as Error).message;
              toast.error(
                errorMessage || "An error occurred while shortening your links."
              );
            }
          });
        };

        reader.readAsText(file);
      }
    }
  };

  return (
    <>
      {/* TODO: UNCOMMENT LATER WHEN EVERYTHING IS STABLE */}
      {/* <div className="justify-end hidden gap-2 mb-4 md:flex">
        <Button asChild variant="secondary">
          <Link href="/dashboard/links/dynamic-links">
            Create a dynamic link instead
          </Link>
        </Button>
      </div> */}

      <section className="grid grid-cols-1 gap-5 mt-6 md:grid-cols-11">
        <div className="flex flex-col col-span-5 gap-4">
          <div className="flex flex-col gap-1">
            <div
              className="options"
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <h1 className="text-2xl">Create your Link </h1>
              <h1 className="text-2xl">Or</h1>
              <Button
                className="border border-white-900 border-2 px-3 py-2"
                onClick={() => {
                  document.getElementById("inputCSV")?.click();
                }}
              >
                {" "}
                Upload CSV
              </Button>
              <input
                type="file"
                id="inputCSV"
                style={{ display: "none" }}
                onChange={handleCSV}
              ></input>
            </div>
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
                    formik.errors.alias && "border-red-500"
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
                  formik.errors.disableLinkAfterClicks && "border-red-500"
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
              This is how your link will be displayed to users on social
              platforms
            </p>
          </div>

          {/* OG Preview cards for twitter, facebook and linkedin */}
          {/* <div className="flex flex-col gap-4">
            <div className="border rounded-lg">
              <div className="flex flex-col p-5 bg-white rounded-lg">
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-gray-500">
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
                <img
                  src={metaData.image || "https://via.placeholder.com/1200x630"}
                  alt="OG Image"
                  className="w-full mt-4 rounded-lg"
                />
              </div>
            </div>
          </div> */}
          <LinkPreviewComponent
            destinationURL={destinationURL}
            // metaData={metaData}
            metaTitle={metaData.title}
            metaDescription={metaData.description}
            metaImage={metaData.image}
          />
        </div>
      </section>
    </>
  );
};

export default LinkEditForm;
