"use client";

import { Prisma } from "@prisma/client";
import { useFormik } from "formik";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import * as Yup from "yup";

import { createDynamicLinkChildLink } from "@/actions/dynamic-links-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import LinkPreviewComponent from "./link-preview-component";

type FormFields = Omit<
  Prisma.DynamicLinkChildLinkCreateInput,
  "user" | "dynamicLink"
>;

type FormProps = {
  formFields?: FormFields;
  selectedProject?: number;
  userDynamicLinksProjects?: Prisma.DynamicLinkGetPayload<{}>[];
  selectedLinkID?: number;
};
const DynamicLinksForm = ({
  formFields,
  userDynamicLinksProjects,
  selectedProject: selectedProjectId,
  selectedLinkID,
}: FormProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [selectedProject, setSelectedProject] = useState<number | null>(
    selectedProjectId || null,
  );

  const showToastNotification = (title: string, description: string) => {
    toast({
      title,
      description,
      variant: "destructive",
    });
  };

  const handleShortLinkValidation = async (value: string) => {
    if (!selectedProject || !value) {
      return;
    }

    const response = await fetch(
      `/api/links/dynamic-links/validate-shortlink?shortLink=${value}&projectID=${selectedProject}`,
    );

    if (response.status === 200) {
      formik.setFieldError("shortLink", "");
    }

    if (response.status === 400 || response.status === 404) {
      formik.setFieldError("shortLink", "Short link is not available");
    }
  };

  const formik = useFormik<FormFields>({
    initialValues: {
      link: formFields?.link || "",
      metaDataTitle: formFields?.metaDataTitle || "",
      metaDataDescription: formFields?.metaDataDescription || "",
      metaDataImageUrl: formFields?.metaDataImageUrl || "",
      shortLink: formFields?.shortLink || "",
      fallbackLink: formFields?.fallbackLink || "",
    },
    validationSchema: Yup.object({
      link: Yup.string().required("Link is required"),
      metaDataTitle: Yup.string().optional(),
      metaDataDescription: Yup.string().optional(),
      metaDataImageUrl: Yup.string().url("Please enter a valid URL").optional(),
      shortLink: Yup.string().optional(),
      fallbackLink: Yup.string().url("Please enter a valid URL").optional(),
    }),
    onSubmit: (values) => {
      startTransition(async () => {
        if (!selectedProject) {
          toast({
            title: "Uh oh!",
            description: "Please select a project",
            variant: "destructive",
          });
          return;
        }

        const response = await createDynamicLinkChildLink(
          { ...values, createdFromUI: true },
          selectedProject,
          selectedLinkID,
        );

        if (response) {
          if ("error" in response) {
            showToastNotification("Uh oh!", "Could not create link");
          } else if ("alreadyExists" in response) {
            showToastNotification(
              "Uh oh!",
              "You already have the same link in this project",
            );
          } else if ("id" in response) {
            showToastNotification(
              "Success",
              `Link ${selectedLinkID ? "updated" : "created"} successfully`,
            );
          }
        }

        formik.resetForm();
        router.push("/dashboard/links/dynamic");
      });
    },
  });

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-11">
      <section className="flex flex-col col-span-5 gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Dynamic Links</h1>
          <p className="text-sm text-gray-500">
            Create links that your app thrives on
          </p>
        </div>

        {/* Link details, and subdomain */}
        <form className="flex flex-col gap-6" onSubmit={formik.handleSubmit}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="link">Enter a link</Label>
              <span className="text-sm text-gray-500">
                The link your app can handle
              </span>
            </div>
            <Input
              id="link"
              placeholder="https://example.com"
              {...formik.getFieldProps("link")}
              className={cn(
                formik.errors.link && formik.touched.link && "border-red-500",
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fallbackLink">Enter a fallback link</Label>
              <span className="text-sm text-gray-500">
                The link to open on an unsupported device
              </span>
            </div>
            <Input
              id="fallbackLink"
              placeholder="https://example.com"
              {...formik.getFieldProps("fallbackLink")}
              className={cn(
                formik.errors.fallbackLink &&
                  formik.touched.fallbackLink &&
                  "border-red-500",
              )}
            />
            <span className="text-sm text-red-500">
              {formik.errors.fallbackLink &&
                formik.touched.fallbackLink &&
                formik.errors.fallbackLink}
            </span>
          </div>

          {/* main project tagging */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="project">Select a project</Label>
              <span className="text-sm text-gray-500">
                Projects tag you links to your applications and websites
              </span>
            </div>
            <Select
              onValueChange={(value: string) => {
                setSelectedProject(Number(value));
              }}
              value={selectedProject?.toString()}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Projects</SelectLabel>
                  {userDynamicLinksProjects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* short link */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="shortLink">Short Link</Label>
              <span className="text-sm text-gray-500">
                Optional, leave blank to generate a random short link
              </span>
            </div>
            <Input
              id="shortLink"
              placeholder="xyz"
              type="text"
              {...formik.getFieldProps("shortLink")}
              className={cn(
                formik.errors.shortLink &&
                  formik.touched.shortLink &&
                  "border-red-500",
              )}
              onBlur={(e) => {
                handleShortLinkValidation(e.target.value);
                formik.handleBlur(e);
              }}
            />
            <span className="text-sm text-red-500">
              {formik.errors.shortLink && formik.touched.shortLink
                ? formik.errors.shortLink
                : ""}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-3 mb-3">
            <div className="flex-grow border-t border-gray-200" />
            <span className="text-gray-500">Metadata Configuration</span>
            <div className="flex-grow border-t border-gray-200" />
          </div>

          {/* meta data */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="Meta Data">Title</Label>
              <span className="text-sm text-gray-500">
                The title displayed in the link preview.
              </span>
            </div>
            <Input
              id="Link Preview Title"
              placeholder="Preview Title"
              type="text"
              {...formik.getFieldProps("metaDataTitle")}
            />
          </div>

          {/* meta data */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="Meta Data Description">Preview Description</Label>
              <span className="text-sm text-gray-500">
                The description displayed in the link preview.
              </span>
            </div>
            <Input
              id="Meta Data Description"
              placeholder="Preview Description"
              {...formik.getFieldProps("metaDataDescription")}
              className={cn(
                formik.errors.metaDataDescription &&
                  formik.touched.metaDataDescription &&
                  "border-red-500",
              )}
            />
          </div>

          {/* meta data */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="Meta Data Image Url">Preview Image Url</Label>
              <span className="text-sm text-gray-500">
                The image displayed in the link preview.
              </span>
            </div>
            <Input
              id="Meta Data Image Url"
              placeholder="Preview Image Url"
              {...formik.getFieldProps("metaDataImageUrl")}
              className={cn(
                formik.errors.metaDataImageUrl &&
                  formik.touched.metaDataImageUrl &&
                  "border-red-500",
              )}
            />
          </div>

          {/* submit button */}
          <Button className="mt-2" disabled={loading} type="submit">
            Save Dynamic Link
            {loading && <Loader2 className="ml-2 animate-spin" />}
          </Button>
        </form>
      </section>

      <div className="items-center justify-center hidden md:flex">
        <div className="h-screen border-r border-gray-200" />
      </div>
      <div className="flex flex-col col-span-5 gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Link Preview</h1>
          <p className="text-sm text-gray-500">
            This is how your link will be displayed to users on social platforms
          </p>
        </div>
        <LinkPreviewComponent
          destinationURL={formik.values.link}
          metaTitle={formik.values.metaDataTitle}
          metaDescription={formik.values.metaDataDescription}
          metaImage={formik.values.metaDataImageUrl}
        />
      </div>
    </div>
  );
};

export default DynamicLinksForm;
