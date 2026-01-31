"use client";

import React from "react";
import { Ban } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { satoshi } from "@/styles/fonts";

type BlockedPageProps = {
  params: Promise<{
    linkId: string;
  }>;
};

export default function BlockedPage({ params }: BlockedPageProps) {
  const { linkId } = React.use(params);
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  return (
    <div
      className={`flex h-screen flex-col items-center justify-center ${satoshi.className}`}
    >
      <h1 className="mb-10 text-4xl font-bold">iShortn</h1>

      <div className="flex flex-col items-center gap-4 text-center px-4">
        <Ban className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p className="max-w-md text-gray-600">
          {message || "This link is not available in your region."}
        </p>
      </div>
    </div>
  );
}
