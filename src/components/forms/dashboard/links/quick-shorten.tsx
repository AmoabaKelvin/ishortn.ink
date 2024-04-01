"use client";

import { useFormik } from "formik";
import { useTransition } from "react";
import { toast } from "sonner";
import * as yup from "yup";

import { quickLinkShorten } from "@/actions/link-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QuickShortenForm = () => {
  const [loading, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: {
      url: "",
    },
    validationSchema: yup.object({
      url: yup.string().url().required(),
    }),
    onSubmit: async (values) => {
      startTransition(async () => {
        const response = await quickLinkShorten(values.url);

        if (response && "id" in response) {
          toast.success("Your link has been shortened.");
        } else {
          toast.error("An error occurred while shortening your link.");
        }

        formik.resetForm();
      });
    },
  });

  return (
    <form className="mt-4" onSubmit={formik.handleSubmit}>
      <Label htmlFor="url"> Paste URL</Label>
      <Input
        id="url"
        type="url"
        placeholder="https://example.com"
        {...formik.getFieldProps("url")}
        className={`${
          formik.touched.url && formik.errors.url && "border-red-500"
        }`}
      />
      <span className="text-xs text-red-500">
        {formik.touched.url && formik.errors.url}
      </span>
      <Button className="w-full mt-5" type="submit" disabled={loading}>
        Shorten
      </Button>
    </form>
  );
};

export default QuickShortenForm;
