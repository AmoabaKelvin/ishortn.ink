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

import { toast } from "react-hot-toast";

import { validateUrlInput, copyToClipboard } from "@/lib/utils";

export function TryOutTab() {
  const [orginalLink, setOrginalLink] = useState("");
  const [shortUrl, setShortUrl] = useState("");

  const handleLinkShortenGeneration = async () => {
    if (!validateUrlInput(orginalLink)) {
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
                  <span>https://ishortn.ink/{shortUrl}</span>
                  <Button
                    variant={"outline"}
                    size={"sm"}
                    onClick={() => copyToClipboard(shortUrl)}
                  >
                    Copy
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
