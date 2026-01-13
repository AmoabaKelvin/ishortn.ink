import type { Metadata } from "next";

import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";

export const runtime = "edge";
export const fetchCache = "force-no-store";

type CloakedPageProps = {
  params: Promise<{ url: string }>;
};

/**
 * Extracts the apex domain from a URL for favicon fetching.
 * Example: https://www.example.com/path -> example.com
 */
function getApexDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix if present
    const withoutWww = hostname.replace(/^www\./, "");
    // Get the last two parts of the domain (or more for country TLDs like .co.uk)
    const parts = withoutWww.split(".");
    if (parts.length > 2) {
      // Handle cases like .co.uk, .com.br, etc.
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      if (lastPart && secondLastPart && lastPart.length <= 3 && secondLastPart.length <= 3) {
        return parts.slice(-3).join(".");
      }
    }
    return parts.slice(-2).join(".");
  } catch {
    // Return empty string on parse failure so favicon service gets a safe fallback
    return "";
  }
}

export async function generateMetadata(props: CloakedPageProps): Promise<Metadata> {
  const params = await props.params;
  const url = decodeURIComponent(params.url);

  try {
    const metatags = await fetchMetadataInfo(url);
    const apexDomain = getApexDomain(url);

    return {
      title: metatags.title || "Redirecting...",
      description: metatags.description || "",
      icons: {
        icon: `https://www.google.com/s2/favicons?domain=${apexDomain}&sz=64`,
      },
      openGraph: {
        title: metatags.title || "",
        description: metatags.description || "",
        images: metatags.image ? [metatags.image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: metatags.title || "",
        description: metatags.description || "",
        images: metatags.image ? [metatags.image] : [],
      },
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching metadata for cloaked page:", error);
    return {
      title: "Redirecting...",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function CloakedPage(props: CloakedPageProps) {
  const params = await props.params;
  const url = decodeURIComponent(params.url);

  // Validate and normalize the URL before rendering
  let validatedUrl: string;
  try {
    const parsedUrl = new URL(url);
    // Only allow http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <p className="text-gray-500">Invalid URL protocol</p>
        </div>
      );
    }
    validatedUrl = parsedUrl.toString();
  } catch {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-gray-500">Invalid URL</p>
      </div>
    );
  }

  return (
    <iframe
      src={validatedUrl}
      title="Cloaked content"
      className="h-screen w-full border-none"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
      // Security note: allow-same-origin is required for most websites to function properly
      // (login, cookies, storage). allow-scripts is needed for interactive content.
      // The URL is validated above to only allow http/https protocols.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
