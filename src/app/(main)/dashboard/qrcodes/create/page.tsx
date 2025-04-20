"use client";

import { useTransitionRouter } from "next-view-transitions";
import posthog from "posthog-js";
import QrCodeWithLogo from "qrcode-with-logos";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";
import { checkIfUserCanCreateMoreQRCodes } from "../utils";

import QRCodeContent from "./qr-content";
import QRCodeCustomization from "./qr-customization";
import { isValidUrlAndNotIshortn } from "./utils";

import type { CornerType } from "qrcode-with-logos/types/src/core/types";
import type { CornerStyle, PatternStyle } from "./types";
function QRCodeCreationPage() {
  const router = useTransitionRouter();
  const userSubDetails = api.subscriptions.get.useQuery().data;

  const canCreateMoreQRCodes = checkIfUserCanCreateMoreQRCodes(userSubDetails);

  const qrCodeCreateMutation = api.qrCode.create.useMutation({
    onSuccess: async (data) => {
      toast.success("QR Code created successfully");
      const link = document.createElement("a");
      link.href = data!;
      link.download = "qrcode.png";
      link.click();

      await revalidateRoute("/dashboard/qrcodes");
      router.push("/dashboard/qrcodes");
    },
  });
  const shortenLinkMutation = api.link.quickShorten.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [qrCodeTitle, setQRCodeTitle] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState("#198639");
  const [patternStyle, setPatternStyle] = useState<PatternStyle>("diamond");
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>("square");
  const [enteredContent, setEnteredContent] = useState<string>("");
  const [logoImage, setLogoImage] = useState<string | null>(null);

  const generateQRCode = (content: string) => {
    const qrCodeConfig = {
      content,
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
  };

  const handleSaveQRCode = async () => {
    posthog.capture("qr_code_created");

    if (!enteredContent) {
      toast.error("Please enter a content for the QR Code");
      return;
    }

    let finalContent = enteredContent;
    let wasShortened = false;

    if (isValidUrlAndNotIshortn(enteredContent)) {
      try {
        const createdShortLink = await shortenLinkMutation.mutateAsync({
          url: enteredContent,
        });
        if (createdShortLink?.alias) {
          finalContent = `https://ishortn.ink/${createdShortLink.alias}`;
          wasShortened = true;
        }
      } catch (_error) {
        toast.error("Failed to shorten link. Using original content.");
      }
    }

    const qrCode = new QrCodeWithLogo({
      content: finalContent,
      width: 1000,
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
    });

    await qrCode.getCanvas().then((canvas) => {
      const url = canvas.toDataURL("image/png", 1.0);

      const qrCodeData = {
        wasShortened,
        title: qrCodeTitle,
        content: finalContent,
        patternStyle,
        cornerStyle,
        selectedColor,
        qrCodeBase64: url,
      };

      toast.promise(qrCodeCreateMutation.mutateAsync(qrCodeData), {
        loading: "Creating QR Code...",
        success: "QR Code created successfully",
        error: "Failed to create QR Code",
      });
    });
  };

  useEffect(() => {
    generateQRCode(enteredContent || "https://ishortn.ink");
  }, [enteredContent, patternStyle, cornerStyle, selectedColor, logoImage]);

  return (
    <div className="flex flex-col md:flex-row">
      <div className="w-full md:w-[50%] md:border-r-2 md:pr-16">
        <QRCodeContent
          qrCodeTitle={qrCodeTitle}
          setQRCodeTitle={setQRCodeTitle}
          enteredContent={enteredContent}
          setEnteredContent={setEnteredContent}
        />

        <QRCodeCustomization
          patternStyle={patternStyle}
          setPatternStyle={setPatternStyle}
          cornerStyle={cornerStyle}
          setCornerStyle={setCornerStyle}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          setLogoImage={setLogoImage}
        />
        <Button
          className="w-full mt-6"
          onClick={handleSaveQRCode}
          disabled={!canCreateMoreQRCodes}
        >
          Generate QR Code
        </Button>
      </div>
      <div className="flex w-full flex-col items-center md:w-[50%]">
        <h1 className="text-2xl font-bold">Preview</h1>
        <canvas id="canvas" className="max-w-xs" />
      </div>
    </div>
  );
}

export default QRCodeCreationPage;
