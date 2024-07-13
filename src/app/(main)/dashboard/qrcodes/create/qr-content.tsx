import { motion } from "framer-motion";
import { Info } from "lucide-react";

import { Input } from "@/components/ui/input";

import { isValidUrlAndNotIshortn } from "./utils";

interface QRCodeContentProps {
  qrCodeTitle: string;
  setQRCodeTitle: (title: string) => void;
  enteredContent: string;
  setEnteredContent: (content: string) => void;
}

function QRCodeContent({
  qrCodeTitle,
  setQRCodeTitle,
  enteredContent,
  setEnteredContent,
}: QRCodeContentProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold">QRCode Content</h1>
      <div className="mb-5">
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="w-full">
            <Input
              className="mt-3 w-full"
              placeholder="Enter a title for the QR Code"
              value={qrCodeTitle}
              onChange={(e) => setQRCodeTitle(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">
              This will be used to identify the QR Code
            </span>
          </div>
          <Input
            className="mt-3"
            placeholder="Enter the content for the QR Code"
            value={enteredContent}
            onChange={(e) => setEnteredContent(e.target.value)}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isValidUrlAndNotIshortn(enteredContent) ? 1 : 0 }}
            className="flex items-center text-sm text-muted-foreground"
          >
            <Info className="mr-1 size-4" />
            We will shorten the link to track scan counts
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default QRCodeContent;
