"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useFormik } from "formik";
import { useState } from "react";
import * as Yup from "yup";

import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";

import { createDynamicLink } from "@/actions/dynamic-links-actions";
import { subdomainsThatAreNotAllowed } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { useRouter } from "next/navigation";

type FormFields = Omit<Prisma.DynamicLinkCreateInput, "user" | "childLinks">;

interface FormProps {
  initialValues?: FormFields;
  projectId?: number;
}

const DynamicLinksForm = ({ initialValues, projectId }: FormProps) => {
  const { toast } = useToast();
  const [loading, startTransition] = useTransition();
  const [subdomain, setSubdomain] = useState<string>("");
  const router = useRouter();

  const formik = useFormik<FormFields>({
    initialValues: {
      subdomain: initialValues?.subdomain || "",
      name: initialValues?.name || "",
      iosBundleId: initialValues?.iosBundleId || "",
      iosTeamId: initialValues?.iosTeamId || "",
      appStoreUrl: initialValues?.appStoreUrl || "",
      androidPackageName: initialValues?.androidPackageName || "",
      androidSha256Fingerprint: initialValues?.androidSha256Fingerprint || "",
      playStoreUrl: initialValues?.playStoreUrl || "",
    },
    validationSchema: Yup.object({
      name: Yup.string().required("Name is required"),
      subdomain: Yup.string()
        .required("Subdomain is required")
        .matches(/^[a-zA-Z0-9]+$/, "Only letters and numbers are allowed")
        .notOneOf(subdomainsThatAreNotAllowed, "Subdomain is not allowed"),
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
        const response = await createDynamicLink(values, projectId);

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
            description: `Link ${
              projectId ? "updated" : "created"
            } successfully`,
          });
        }
        formik.resetForm();
        router.push("/dashboard/links/dynamic");
      });
    },
  });

  const validateSubdomain = async (subdomain: string) => {
    // if response is 200, there is a subdomain available
    // if response is 400, there is no subdomain available
    if (formik.errors.subdomain) return;

    const response = await fetch(`/api/links/domains?subdomain=${subdomain}`);

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
            <Label htmlFor="Subdomain">Enter a name for this link</Label>
          </div>
          <Input
            id="Link Project Name"
            type="text"
            placeholder="myapp"
            {...formik.getFieldProps("name")}
            className={cn(
              formik.errors.name && formik.touched.name && "border-red-500",
            )}
          />
          <span className="text-sm text-red-500">
            {formik.errors.name && formik.touched.name
              ? formik.errors.name
              : null}
          </span>
        </div>
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
            {formik.errors.iosTeamId &&
              formik.touched.iosTeamId &&
              formik.errors.iosTeamId}
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
