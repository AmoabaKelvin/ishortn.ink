import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as z from "zod";

import prisma from "@/db";

import { generateShortLink } from "./links";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const urlInputSchema = z.object({
  url: z.string().url(),
});

export function validateUrlInput(input: unknown): input is { url: string } {
  return urlInputSchema.safeParse(input).success;
}

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export const fullUrlRegex =
  /(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z]{2,}(\.[a-zA-Z]{2,})(\.[a-zA-Z]{2,})?\/[a-zA-Z0-9]{2,}|((https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z]{2,}(\.[a-zA-Z]{2,})(\.[a-zA-Z]{2,})?)|(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z0-9]{2,}\.[a-zA-Z0-9]{2,}\.[a-zA-Z0-9]{2,}(\.[a-zA-Z0-9]{2,})?/g;

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    host = window.location.host;
  }
  // we should improve here for custom vercel deploy page
  if (host && host.includes(".") && !host.includes(".vercel.app")) {
    const candidate = host.split(".")[0];
    if (candidate && !candidate.includes("www")) {
      // Valid candidate
      subdomain = candidate;
    }
  }
  if (host && host.includes("ngrok-free.app")) {
    return null;
  }

  return subdomain;
};

export const checkShortURLIsAvailableForProject = async (
  shortUrl: string,
  projectID: number,
): Promise<boolean> => {
  const project = await prisma.dynamicLink.findUnique({
    where: {
      id: projectID,
    },
    include: {
      childLinks: {
        where: {
          shortLink: shortUrl,
        },
      },
    },
  });

  if (!project) {
    return false;
  }

  if (project.childLinks.length === 0) {
    return true;
  }

  return false;
};

export const generateShortLinkForProject = async (
  longURL: string,
  projectID: number,
): Promise<string> => {
  const generatedShortLink = await generateShortLink();

  // now we check if the url is already in the project, if so, we generate a new one
  const isAvailable = await checkShortURLIsAvailableForProject(
    generatedShortLink,
    projectID,
  );

  if (!isAvailable) {
    return generateShortLinkForProject(longURL, projectID);
  }

  return generatedShortLink;
};
