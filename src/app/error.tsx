"use client";

import Link from "next/link";

import { LinkShortenerAndQRGenerator } from "@/components/forms/link-shortener-and-qr-generator";
import { Button } from "@/components/ui/button";

const LinkNotFoundErrorPage = () => {
  return (
    <>
      {/* <LandingPageBanner /> */}
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-5xl font-ocean">
          Hmmm, we couldn&apos;t find that link :(
        </h1>
        <p className="my-2 text-2xl font-mazzard">
          Perhaps, you might want to shorten one
        </p>

        <div className="mt-10">
          <LinkShortenerAndQRGenerator />
        </div>

        <div className="flex flex-col items-center my-4">
          <p>or</p>
          <Button variant="link" className="text-white">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default LinkNotFoundErrorPage;
