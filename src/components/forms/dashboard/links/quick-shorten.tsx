"use client";

import { useFormik } from "formik";
import { useTransition } from "react";

import { quickLinkShorten } from "@/app/dashboard/_actions/link-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const QuickShortenForm = () => {
  const { toast } = useToast();
  const [loading, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: {
      url: "",
    },
    onSubmit: async (values) => {
      startTransition(async () => {
        const response = await quickLinkShorten(values.url);

        if (response && "id" in response) {
          toast({
            title: "Link shortened",
            description: "Your link has been shortened.",
          });
        } else {
          toast({
            title: "Error",
            description: "An error occurred while shortening your link.",
            variant: "destructive",
          });
        }

        formik.resetForm();
      });
    },
  });

  return (
    <form className="mt-4" onSubmit={formik.handleSubmit}>
      <Label htmlFor="url">URL</Label>
      <Input
        id="url"
        type="url"
        placeholder="https://example.com"
        {...formik.getFieldProps("url")}
      />
      <Button className="w-full mt-5" type="submit" disabled={loading}>
        Shorten
      </Button>
    </form>
  );
};

export default QuickShortenForm;
