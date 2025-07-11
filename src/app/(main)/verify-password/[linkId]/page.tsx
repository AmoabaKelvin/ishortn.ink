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

  // Get link information by ID to determine domain
  const { data: linkData } = api.link.get.useQuery({ id: parseInt(linkId) });

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
    router.push(result.url!);
  };

  // Determine what to display based on domain
  const getDisplayTitle = () => {
    if (!linkData?.domain) return "iShortn";
    return linkData.domain === "ishortn.ink" ? "iShortn" : linkData.domain;
  };

  return (
    <div
      className={`flex h-screen flex-col items-center justify-center ${satoshi.className}`}
    >
      <h1 className="mb-10 text-4xl font-bold">{getDisplayTitle()}</h1>

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