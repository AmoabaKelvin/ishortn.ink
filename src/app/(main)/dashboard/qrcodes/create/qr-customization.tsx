import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cornerStyles, patternStyles } from "./constants";
import ColorPicker from "./qr-color-picker";
import LogoUploader from "./qr-logo-uploader";

import type { CornerStyle, PatternStyle } from "./types";

interface QRCodeCustomizationProps {
  patternStyle: PatternStyle;
  setPatternStyle: (style: PatternStyle) => void;
  cornerStyle: CornerStyle;
  setCornerStyle: (style: CornerStyle) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  setLogoImage: (image: string | null) => void;
}

function QRCodeCustomization({
  patternStyle,
  setPatternStyle,
  cornerStyle,
  setCornerStyle,
  selectedColor,
  setSelectedColor,
  setLogoImage,
}: QRCodeCustomizationProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Customize your QR Code</h1>
      <div className="mt-3 flex flex-col gap-8">
        <div>
          <span className="text-lg">Select pattern style</span>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <Select
              value={patternStyle}
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
              value={cornerStyle}
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

        <ColorPicker selectedColor={selectedColor} setSelectedColor={setSelectedColor} />
        <LogoUploader setLogoImage={setLogoImage} />
      </div>
    </div>
  );
}

export default QRCodeCustomization;
