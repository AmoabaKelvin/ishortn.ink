"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ClientProvider = () => {
  const router = useRouter();

  // Listen for CMD/CTRL + K and redirect to the /dashboard/links page
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
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
