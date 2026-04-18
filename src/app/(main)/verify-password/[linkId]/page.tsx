"use client";

import React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

type VerifyPasswordPageProps = {
  params: Promise<{
    linkId: string;
  }>;
};

export default function VerifyPasswordPage({ params }: VerifyPasswordPageProps) {
  const { linkId } = React.use(params);
  const verifyPasswordMutation = api.link.verifyLinkPassword.useMutation();
  const router = useTransitionRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    const result = await verifyPasswordMutation.mutateAsync({
      id: parseInt(linkId),
      password,
    });

    if (!result) {
      toast("Entered password incorrect", {
        icon: <TriangleAlert />,
        style: {
          background: "#ef4444",
          color: "#fff",
          border: "1px solid #ef4444",
        },
        className: "class",
      });
      return;
    }

    toast.success("Password verified! Redirecting...");

    // When the link has verified clicks on, route through the interstitial
    // page so the beacon fires. Force a full navigation (not router.push)
    // because the interstitial relies on an inline <script> that only runs
    // reliably on a fresh page load.
    if (result.verificationToken) {
      const alias = encodeURIComponent(result.alias ?? "l");
      const to = encodeURIComponent(result.url!);
      const t = encodeURIComponent(result.verificationToken);
      window.location.href = `/verified-redirect/${alias}?to=${to}&t=${t}`;
      return;
    }

    router.push(result.url!);
  };

  return (
    <div
      className={`flex h-screen flex-col items-center justify-center ${satoshi.className}`}
    >
      <h1 className="mb-10 text-4xl font-bold">iShortn</h1>

      <h1 className="text-2xl font-bold">This link is password protected</h1>
      <form
        className="mt-4 flex w-full flex-col items-center justify-center"
        onSubmit={handleSubmit}
      >
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-[85%] rounded-md border border-gray-300 p-2 md:w-96"
        />
        <Button
          type="submit"
          disabled={verifyPasswordMutation.isLoading}
          className="mt-2 w-[85%] rounded-md bg-blue-500 p-2 text-white md:w-96"
        >
          {verifyPasswordMutation.isLoading && (
            <Loader2 className="mr-2 inline-block animate-spin" />
          )}
          Submit
        </Button>
      </form>
    </div>
  );
}