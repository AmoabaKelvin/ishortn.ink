"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "../ui/use-toast";

const ClientProvider = () => {
  const router = useRouter();
  const { toast } = useToast();

  // Listen for CMD/CTRL + K and redirect to the /dashboard/links page
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        toast({
          title: "👋 Redirecting to page...",
          description: "You are being redirected to the links page.",
          duration: 500,
        });
        router.push("/dashboard/links");
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);

  return null;
};

export default ClientProvider;
