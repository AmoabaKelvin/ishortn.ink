"use client";

import QrCodeWithLogo from "qrcode-with-logos";
// import QRCode as Q from "q";
import { useCallback, useEffect, useState } from "react";

// import { QRCode } from "react-qrcode-logo";
// import QrCode from "qrcode-with-logos"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { CornerType } from "qrcode-with-logos/types/src/core/types";
const presetColors = ["#198639", "#34A853", "#E55934", "#2D2E33", "#000000", "#FFD600", "#FF585D"];

type PatternStyle =
  | "square"
  | "diamond"
  | "star"
  | "fluid"
  | "rounded"
  | "tile"
  | "stripe"
  | "fluid-line"
  | "stripe-column";

type CornerStyle =
  | "circle"
  | "circle-diamond"
  | "square"
  | "square-diamond"
  | "rounded-circle"
  | "rounded"
  | "circle-star";

const cornerStyles: CornerStyle[] = [
  "circle",
  "circle-diamond",
  "square",
  "square-diamond",
  "rounded-circle",
  "rounded",
  "circle-star",
];

const patternStyles: PatternStyle[] = [
  "square",
  "diamond",
  "star",
  "fluid",
  "rounded",
  "tile",
  "stripe",
  "fluid-line",
  "stripe-column",
];

function QRCodeCreationPage() {
  const [qrContentType, setQrContentType] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#198639");
  const [patternStyle, setPatternStyle] = useState<PatternStyle>("diamond");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");
  const [enteredContent, setEnteredContent] = useState<string>("");
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("File size exceeds 2MB limit");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoImage(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError("Error reading file");
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("File size exceeds 2MB limit");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoImage(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError("Error reading file");
      };
      reader.readAsDataURL(file);
    }
  }, []);

  useEffect(() => {
    const qrCodeConfig = {
      content: enteredContent || "https://ishortn.ink",
      width: 1000,
      canvas: document.getElementById("canvas") as HTMLCanvasElement,
      dotsOptions: {
        type: patternStyle,
        color: selectedColor,
      },
      cornersOptions: {
        type: cornerStyle as CornerType,
        color: selectedColor,
      },
      nodeQrCodeOptions: {
        margin: 20,
        color: {
          dark: "#fafafa",
        },
      },
    };

    // Conditionally add the logo property if an image has been uploaded
    if (logoImage) {
      Object.assign(qrCodeConfig, {
        logo: {
          src: logoImage,
        },
      });
    }

    new QrCodeWithLogo(qrCodeConfig);
  });

  return (
    <div className="flex flex-col md:flex-row">
      <div className="w-full md:w-[50%] md:border-r-2 md:pr-16">
        <h1 className="text-2xl font-bold">QRCode Content</h1>

        {/* type: link or plain text */}
        <div className="mb-9">
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Select onValueChange={(value) => setQrContentType(value)}>
              <SelectTrigger className="">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>

            {qrContentType && (
              <Input
                className="mt-3"
                value={enteredContent}
                onChange={(e) => {
                  setEnteredContent(e.target.value);
                }}
              />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold">Customize your QR Code</h1>
        <div className="mt-3 flex flex-col gap-8">
          <div>
            <span className="text-lg">Select pattern style</span>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Select
                defaultValue="diamond"
                onValueChange={(value) => setPatternStyle(value as PatternStyle)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pattern style" />
                </SelectTrigger>
                <SelectContent>
                  {patternStyles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="mt-5 inline-block text-lg">Select corner style</span>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Select
                defaultValue="square"
                onValueChange={(value) => setCornerStyle(value as CornerStyle)}
              >
                <SelectTrigger className="">
                  <SelectValue placeholder="Select corner style" />
                </SelectTrigger>
                <SelectContent>
                  {cornerStyles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <span className="text-lg">Select color</span>
            <div className="mt-2 flex flex-wrap gap-4">
              {presetColors.map((color) => (
                <div
                  key={color}
                  className={cn("rounded-full border-2 p-1 hover:cursor-pointer", {
                    "border-blue-400": selectedColor === color,
                  })}
                  onClick={() => setSelectedColor(color)}
                >
                  <div className="size-11 rounded-full" style={{ backgroundColor: color }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 mt-6 text-lg">Add a logo</h2>
          <div
            className="mt-1 flex justify-center rounded-md border-2 border-dashed border-input px-6 pb-6 pt-5"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="space-y-1 text-center">
              <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="flex text-sm text-muted-foreground">
                <label
                  htmlFor="image"
                  className="relative cursor-pointer rounded-md bg-background font-medium text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary-foreground"
                >
                  <span>Upload a file</span>
                  <Input
                    id="image"
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    accept="image/*"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 2MB</p>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
        </div>

        <Button className="mt-6 w-full">Generate QR Code</Button>
      </div>
      <div className="flex w-full flex-col items-center md:w-[50%]">
        <h1 className="text-2xl font-bold">Preview</h1>
        <canvas id="canvas" className="max-w-xs" />
        <div className="mt-4 flex gap-4">
          <Button className="w-[135px]">Download</Button>
          <Button className="w-[135px]">Reset</Button>
        </div>
      </div>
    </div>
  );
}

export default QRCodeCreationPage;

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
