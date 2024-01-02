import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useState } from "react";

import { useFormik } from "formik";

interface UrlShortnerInputs {
  url: string;
  alias: string;
}

const LinkShortenerTab = () => {
  const [shortUrl, setShortUrl] = useState("");
  const [linkCopied, setlinkCopied] = useState("Copy");
  const [loading, setLoading] = useState(false);

  const formik = useFormik<UrlShortnerInputs>({
    initialValues: {
      url: "",
      alias: "",
    },
    onSubmit: async (values) => {
      setLoading(true);

      const url = await axios
        .post("/api/links/", {
          ...values,
        })
        .then((res) => {
          return JSON.parse(res.data).url;
        });
      setShortUrl(url);
      setLoading(false);
    },
  });

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(shortUrl);
    setlinkCopied("Copied!");
    setTimeout(() => setlinkCopied("Copy"), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shorten a link</CardTitle>
        <CardDescription>
          Create beautiful short links for your brand.
        </CardDescription>
      </CardHeader>
      <form onSubmit={formik.handleSubmit}>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="name">URL</Label>
            <Input
              id="url"
              placeholder="https://somelongurl.com"
              type="url"
              required
              {...formik.getFieldProps("url")}
            />

            {/* Custom link aliases */}
          </div>
          <div>
            <Label htmlFor="alias">Customize your link</Label>
            <span className="text-xs text-gray-400">(optional)</span>
            <Input
              id="alias"
              placeholder="Enter an alias for your link"
              type="text"
              minLength={3}
              maxLength={20}
              className={cn(
                "border-slate-100",
                formik.errors.alias && "border-red-500",
              )}
              {...formik.getFieldProps("alias")}
            />
          </div>
          <div className="space-y-1">
            {shortUrl && (
              <div className="flex items-center justify-between p-2 font-mono text-sm rounded bg-slate-100">
                <span>{shortUrl}</span>
                <Button
                  variant={"outline"}
                  size={"sm"}
                  onClick={() => copyToClipboard(shortUrl)}
                  className="hover:from-green-700 hover:to-green-700 hover:border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <span className="flex items-center justify-center">
                    {linkCopied}
                    <Icons.clipboard className="ml-2" />
                  </span>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="text-sm text-white duration-300 bg-black hover:animate-out"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <div className="flex">
                <span className="text-white text-md">loading...</span>
                <Icons.loadingSpinner className="ml-2 animate-spin" />
              </div>
            ) : (
              "Shorten URL"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default LinkShortenerTab;
