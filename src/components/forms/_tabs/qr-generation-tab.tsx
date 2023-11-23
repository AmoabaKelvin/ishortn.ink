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
import React, { useState } from "react";
import QRCode from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { useFormik } from "formik";

interface UrlShortnerInputs {
  content: string;
}

const QRGenerationTab = () => {
  const [enteredContent, setenteredContent] = useState("");
  const qrCodeCanvasRef = React.useRef(null);

  // const {
  //   register,
  //   handleSubmit,
  //   formState: { errors },
  // } = useForm<UrlShortnerInputs>();

  const formik = useFormik<UrlShortnerInputs>({
    initialValues: {
      content: "",
    },
    onSubmit: async (values) => {
      setenteredContent(values.content);
    },
  });

  const downloadQRCode = () => {
    if (!enteredContent) return;
    const canvas = document.getElementById("qr-gen") as HTMLCanvasElement;
    const pngUrl = canvas!
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <Card>
      <form onSubmit={formik.handleSubmit}>
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
              required
              {...formik.getFieldProps("content")}
            />
          </div>
        </CardContent>
        <CardFooter className={cn(enteredContent && "flex-col gap-2.5")}>
          <AnimatePresence mode="wait">
            {enteredContent && (
              <motion.div
                key="qr-code"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.7 }}
              >
                <QRCode
                  id="qr-gen"
                  value={enteredContent}
                  size={300}
                  level={"H"}
                  includeMargin={true}
                  ref={qrCodeCanvasRef}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key="download-button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.7 }}
            >
              <Button
                className="text-sm text-white duration-300 bg-black hover:animate-out"
                type="submit"
                onClick={downloadQRCode}
              >
                {enteredContent ? "Download QR Code" : "Generate QR Code"}{" "}
              </Button>
            </motion.div>
          </AnimatePresence>
        </CardFooter>
      </form>
    </Card>
  );
};

export default QRGenerationTab;
