"use client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

import { linkSchema } from "@/config/schemas/link";
import { toast } from "react-hot-toast";
import { TbClipboardCopy } from "react-icons/tb";

export function TryOutTab() {
  const [orginalLink, setOrginalLink] = useState("");
  const [linkAlias, setLinkAlias] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [urlState, setUrlState] = useState("Copy");

  const handleLinkShortenGeneration = async () => {
    const linkData = linkSchema.safeParse({
      url: orginalLink,
      alias: linkAlias,
    });
    if (!linkData.success) {
      toast.error("Please enter a valid URL", {
        duration: 5000,
        position: "bottom-right",
      });
      return;
    }
    const response = await fetch("/api/links/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: linkData.data.url,
        alias: linkData.data.alias,
      }),
    });

    const data = await response.json();
    const { url } = data;
    setShortUrl(url);
  };

  const CopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setUrlState("Copied!");
    });
    setTimeout(() => {
      setUrlState("Copy");
    }, 3000);
  };

  return (
    <Tabs defaultValue="shorten-link" className="w-[400px] md:w-[500px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger
          value="shorten-link"
          className="data-[state=active]:bg-green-500"
        >
          Shorten Link
        </TabsTrigger>
        <TabsTrigger
          value="qr-code"
          className="data-[state=active]:bg-green-500"
        >
          Generate QR
        </TabsTrigger>
      </TabsList>
      <TabsContent value="shorten-link">
        <Card>
          <CardHeader>
            <CardTitle>Shorten a link</CardTitle>
            <CardDescription>
              Create beautiful short links for your brand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="name">URL</Label>
              <Input
                id="url"
                placeholder="https://somelongurl.com"
                type="url"
                onChange={(e) => setOrginalLink(e.target.value)}
                value={orginalLink}
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
                onChange={(e) => setLinkAlias(e.target.value)}
                value={linkAlias}
                maxLength={10}
                minLength={3}
                className="border-slate-100"
              />
            </div>

            <div className="space-y-1">
              {shortUrl && (
                <div className="p-2 bg-slate-100 rounded font-mono text-sm flex justify-between items-center">
                  <span>{shortUrl}</span>
                  <Button
                    variant={"outline"}
                    size={"sm"}
                    onClick={() => CopyToClipboard(shortUrl)}
                    className="hover:from-green-700 hover:to-green-700 hover:border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <span className="flex items-center justify-center">
                      {urlState}
                      <TbClipboardCopy className="ml-2" />
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleLinkShortenGeneration}>Shorten Link</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="qr-code">
        <Card>
          <CardHeader>
            <CardTitle>Generate QR Code</CardTitle>
            <CardDescription>
              Generate beautiful QR codes for your brand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="current">Link or Text</Label>
              <Input
                id="current"
                type="text"
                placeholder="tosomebeautifulpage.com"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Generate</Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
