import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import React from "react";

const QRGenerationTab = () => {
  return (
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
  );
};

export default QRGenerationTab;
