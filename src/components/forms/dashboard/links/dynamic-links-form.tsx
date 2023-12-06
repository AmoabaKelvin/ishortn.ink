"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useFormik } from "formik";
import { useEffect, useState } from "react";
import * as Yup from "yup";

import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";

import { createDynamicLink } from "@/app/dashboard/_actions/link-actions";
import { subdomainsThatAreNotAllowed } from "@/lib/constants";

interface FormFields {
  subdomain: string;
  fallbackUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  iosBundleId: string;
  iosTeamId: string;
  appStoreUrl: string;
  androidPackageName: string;
  androidSha256Fingerprint: string;
  playStoreUrl: string;
}

const DynamicLinksForm = () => {
  const { toast } = useToast();
  const [loading, startTransition] = useTransition();
  const [subdomain, setSubdomain] = useState<string>("");

  const formik = useFormik<FormFields>({
    initialValues: {
      subdomain: "",
      fallbackUrl: "",
      title: "",
      description: "",
      imageUrl: "",
      iosBundleId: "",
      iosTeamId: "",
      appStoreUrl: "",
      androidPackageName: "",
      androidSha256Fingerprint: "",
      playStoreUrl: "",
    },
    validationSchema: Yup.object({
      subdomain: Yup.string()
        .required("Subdomain is required")
        .matches(/^[a-zA-Z0-9]+$/, "Only letters and numbers are allowed")
        .notOneOf(subdomainsThatAreNotAllowed, "Subdomain is not allowed"),
      fallbackUrl: Yup.string().optional(),
      title: Yup.string().optional(),
      description: Yup.string().optional(),
      imageUrl: Yup.string().optional(),
      iosBundleId: Yup.string().required("iOS Bundle ID is required"),
      iosTeamId: Yup.string().required("Team ID is required"),
      appStoreUrl: Yup.string().url("Please enter a valid URL"),
      androidPackageName: Yup.string().required(
        "Android Package Name is required",
      ),
      androidSha256Fingerprint: Yup.string().required(
        "Android SHA256 Fingerprint is required",
      ),
      playStoreUrl: Yup.string().url("Please enter a valid URL"),
    }),
    onSubmit: (values) => {
      startTransition(async () => {
        console.log(values);

        const response = await createDynamicLink(values);

        console.log(response);

        if (response && "error" in response) {
          toast({
            title: "Uh oh!",
            description: "Could not create link",
            variant: "destructive",
          });
        }

        if (response && "id" in response) {
          toast({
            title: "Success",
            description: "Link created successfully",
          });
        }

        toast({
          title: "Success",
          description: "Link created successfully",
        });
        formik.resetForm();
      });
    },
  });

  const validateSubdomain = async (subdomain: string) => {
    // if response is 200, there is a subdomain available
    // if response is 400, there is no subdomain available
    if (formik.errors.subdomain) return;

    const response = await fetch(
      `/api/links/validate-subdomain?subdomain=${subdomain}`,
    );

    if (response.status === 200) {
      formik.setFieldError("subdomain", "Subdomain is already taken");
      return;
    } else {
      formik.setFieldError("subdomain", "");
      return true;
    }
  };

  const validateFallbackUrl = async (fallbackUrl: string) => {
    const responseFromCall = await fetch(fallbackUrl);

    if (!responseFromCall.ok) {
      formik.setFieldError("fallbackUrl", "URL is not reachable");
      return;
    } else {
      formik.setFieldError("fallbackUrl", "");
      return true;
    }
  };

  useEffect(() => {
    console.log(formik.errors);
  });

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
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
            <Label htmlFor="Subdomain">Enter a subdomain</Label>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                yourapp.ishortn.ink/xyz
              </span>
              <span className="text-sm text-gray-500">
                Custom domains will be available soon
              </span>
            </div>
          </div>
          <Input
            id="Subdomain"
            placeholder="Subdomain"
            {...formik.getFieldProps("subdomain")}
            // onChange={(e) => {
            //   formik.setFieldValue("subdomain", e.target.value);
            // }}
            {...formik.getFieldProps("subdomain")}
            onBlur={(e) => {
              formik.handleBlur(e);
              validateSubdomain(formik.values.subdomain);
            }}
            className={cn(
              formik.errors.subdomain &&
                formik.touched.subdomain &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.subdomain && formik.touched.subdomain
              ? formik.errors.subdomain
              : null}
          </span>
        </div>

        {/* fallback url */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Fallback URL">Fallback URL</Label>
            <span className="text-sm text-gray-500">
              The URL to which the user is redirected if the app isn&apos;t
              installed.
              <span className="text-black">
                {" "}
                Leave blank to redirect to the app store.
              </span>
            </span>
          </div>
          <Input
            id="Fallback URL"
            placeholder="https://example.com"
            {...formik.getFieldProps("fallbackUrl")}
            onBlur={(e) => {
              formik.handleBlur(e);
              validateFallbackUrl(formik.values.fallbackUrl);
            }}
            className={cn(
              formik.errors.fallbackUrl &&
                formik.touched.fallbackUrl &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.fallbackUrl && formik.touched.fallbackUrl
              ? formik.errors.fallbackUrl
              : null}
          </span>
        </div>

        {/* configuration for meta data */}
        <div className="flex items-center gap-4 mt-3 mb-3">
          <div className="flex-grow border-t border-gray-200" />
          <span className="text-gray-500">
            Meta Data Configuration (Optional)
          </span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* title */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Title">Title</Label>
            <span className="text-sm text-gray-500">
              The title to show on preview cards.
            </span>
          </div>
          <Input
            id="Title"
            placeholder="Title"
            {...formik.getFieldProps("title")}
          />
        </div>
        {/* description */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Description">Description</Label>
            <span className="text-sm text-gray-500">
              The description to show on preview cards.
            </span>
          </div>
          <Input
            id="Description"
            placeholder="Description"
            {...formik.getFieldProps("description")}
          />
        </div>
        {/* image url */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Image URL">Image URL</Label>
            <span className="text-sm text-gray-500">
              The URL of the image to use as a thumbnail for this link.
            </span>
          </div>
          <Input
            id="Image URL"
            placeholder="https://example.com/image.png"
            {...formik.getFieldProps("imageUrl")}
          />
        </div>

        {/* Configuration for ios, a horizonal divider with ios in the middle */}
        <div className="flex items-center gap-4 mt-3 mb-3">
          <div className="flex-grow border-t border-gray-200" />
          <span className="text-gray-500">Configuration for iOS</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* ios bundle id */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="iOS Bundle ID">iOS Bundle ID</Label>
            <span className="text-sm text-gray-500">
              The bundle ID of the iOS app to use as the primary link target.
            </span>
          </div>
          <Input
            id="iOS Bundle ID"
            placeholder="com.example.app"
            {...formik.getFieldProps("iosBundleId")}
            className={cn(
              formik.errors.iosBundleId &&
                formik.touched.iosBundleId &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.touched.iosBundleId && formik.errors.iosBundleId
              ? formik.errors.iosBundleId
              : null}
          </span>
        </div>
        {/* team id */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Team ID">Team ID</Label>
            <span className="text-sm text-gray-500">
              The app&apos;s App Store ID, as provided by Apple.
            </span>
          </div>
          <Input
            id="Team ID"
            placeholder="123456789"
            {...formik.getFieldProps("iosTeamId")}
            className={cn(
              formik.errors.iosTeamId &&
                formik.touched.iosTeamId &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.iosTeamId && formik.touched.iosTeamId
              ? formik.errors.iosTeamId
              : null}
          </span>
        </div>
        {/* app store url */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="App Store URL">App Store URL</Label>
            <span className="text-sm text-gray-500">
              The URL of the app in the App Store.
            </span>
          </div>
          <Input
            id="App Store URL"
            placeholder="https://apple.com/xyz"
            {...formik.getFieldProps("appStoreUrl")}
            className={cn(
              formik.errors.appStoreUrl &&
                formik.touched.appStoreUrl &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.appStoreUrl && formik.touched.appStoreUrl
              ? formik.errors.appStoreUrl
              : null}
          </span>
        </div>

        {/* Configuration for android, a horizonal divider with android in the middle */}
        <div className="flex items-center gap-4 mt-3 mb-3">
          <div className="flex-grow border-t border-gray-200" />
          <span className="text-gray-500">Configuration for Android</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* android package name */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Android Package Name">Android Package Name</Label>
            <span className="text-sm text-gray-500">
              The package name of the Android app to use as the primary link
              target.
            </span>
          </div>
          <Input
            id="Android Package Name"
            placeholder="com.example.app"
            {...formik.getFieldProps("androidPackageName")}
            className={cn(
              formik.errors.androidPackageName &&
                formik.touched.androidPackageName &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.androidPackageName &&
            formik.touched.androidPackageName
              ? formik.errors.androidPackageName
              : null}
          </span>
        </div>
        {/* android sha256 fingerprint */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Android SHA256 Fingerprint">
              Android SHA256 Fingerprint
            </Label>
            <span className="text-sm text-gray-500">
              The SHA256 fingerprint of the certificate used to sign the Android
              app.
            </span>
          </div>
          <Input
            id="Android SHA256 Fingerprint"
            placeholder="00:11:22:33:44:55:66:77:88"
            type="text"
            {...formik.getFieldProps("androidSha256Fingerprint")}
            className={cn(
              formik.errors.androidSha256Fingerprint &&
                formik.touched.androidSha256Fingerprint &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.androidSha256Fingerprint &&
            formik.touched.androidSha256Fingerprint
              ? formik.errors.androidSha256Fingerprint
              : null}
          </span>
        </div>

        {/* play store domain */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="Play Store Domain">Play Store URL</Label>
            <span className="text-sm text-gray-500">
              The domain of the Play Store where the app is hosted.
            </span>
          </div>
          <Input
            id="Play Store Domain"
            placeholder="https://play.google.com/xyz"
            {...formik.getFieldProps("playStoreUrl")}
            className={cn(
              formik.errors.playStoreUrl &&
                formik.touched.playStoreUrl &&
                "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.playStoreUrl}
          </span>
        </div>

        {/* submit button */}
        <Button className="mt-2" disabled={loading} type="submit">
          Save Dynamic Link
          {loading && <Loader2 className="ml-2 animate-spin" />}
        </Button>
      </form>
    </div>
  );
};

export default DynamicLinksForm;
