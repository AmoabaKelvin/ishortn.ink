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

import { copyToClipboard, validateUrlInput } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { TbClipboardCopy } from "react-icons/tb";

export function TryOutTab() {
  const [orginalLink, setOrginalLink] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [urlState, setUrlState] = useState("Copy");

  const handleLinkShortenGeneration = async () => {
    if (!validateUrlInput({ url: orginalLink })) {
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
        url: orginalLink,
      }),
    });

    const data = await response.json();
    const { url } = data;
    setShortUrl(url);
  };

  //TODO: use function from lib utils
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
                id="name"
                placeholder="https://somelongurl.com"
                onChange={(e) => setOrginalLink(e.target.value)}
                value={orginalLink}
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
            <Button
              onClick={handleLinkShortenGeneration}
              className="text-sm text-white bg-black hover:text-green-600 hover:bg-green-50 active:scale-95 active:ring-4 active:ring-green-300 transition-transform duration-300 ease-in-out"
            >
              Shorten Link
            </Button>
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
            <Button className="text-sm text-white bg-black hover:text-green-600 hover:bg-green-50 active:scale-95 active:ring-4 active:ring-green-300 transition-transform duration-300 ease-in-out">
              Generate
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
