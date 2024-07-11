"use client";

// import QRCode as Q from "q";
import { useCallback, useState } from "react";
import { QRCode } from "react-qrcode-logo";

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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const presetColors = ["#198639", "#34A853", "#E55934", "#2D2E33", "#000000", "#FFD600", "#FF585D"];

function QRCodeCreationPage() {
  const [qrContentType, setQrContentType] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#198639");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [patternStyle, setPatternStyle] = useState<"dots" | "squares" | "fluid">("dots");
  const [cornerRadius, setCornerRadius] = useState(20);
  const [logoWidth, setLogoWidth] = useState(60);
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

  return (
    <div className="flex flex-col md:flex-row">
      <div className="w-full md:w-[50%] md:border-r-2 md:pr-16">
        <h1 className="text-2xl font-bold">QRCode Content</h1>

        {/* type: link or plain text */}
        <div className="mb-9">
          <span className="text-lg">Select content type</span>
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

            {qrContentType && <Input className="mt-3" />}
          </div>
        </div>

        <h1 className="text-2xl font-bold">Customize your QR Code</h1>
        <div className="mt-3 flex flex-col gap-8">
          <div>
            <span className="text-lg">Select pattern style</span>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Select
                onValueChange={(value) => setPatternStyle(value as "dots" | "squares" | "fluid")}
              >
                <SelectTrigger className="">
                  <SelectValue placeholder="Select pattern style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dots">Dots</SelectItem>
                  <SelectItem value="squares">Squares</SelectItem>
                  <SelectItem value="fluid">Fluid</SelectItem>
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

          <div>
            <span className="text-lg">Corner roundness</span>
            <Slider
              defaultValue={[cornerRadius]}
              max={100}
              step={1}
              className="mt-3"
              onValueChange={(value) => setCornerRadius(value[0]!)}
            />
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
        {logoImage && (
          <div className="mt-6">
            <span className="block text-lg">Logo size</span>
            <span className="text-sm text-muted-foreground">
              QRCode might not be scannable if the logo is too big
            </span>
            <Slider
              defaultValue={[logoWidth]}
              min={20}
              max={150}
              step={1}
              className="mt-3"
              onValueChange={(value) => setLogoWidth(value[0]!)}
            />
            <p className="mt-2 text-sm text-muted-foreground">Logo width: {logoWidth}px</p>
          </div>
        )}
      </div>
      <div className="flex w-full flex-col items-center md:w-[50%]">
        <h1 className="text-2xl font-bold">Preview</h1>
        <div className="relative">
          <QRCode
            value="https://ishortn.ink"
            size={280}
            fgColor={selectedColor}
            bgColor={backgroundColor}
            qrStyle={patternStyle}
            logoImage={logoImage ?? "undefined"}
            // logoWidth={100}
            logoWidth={logoWidth}
            // logoHeight={60}
            quietZone={10}
            removeQrCodeBehindLogo={true}
            eyeRadius={cornerRadius}
          />
          <div className="absolute bottom-0 right-0 rounded-tl-md bg-white p-1 text-xs">
            iShortn.ink
          </div>
        </div>

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
