import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as z from "zod";

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
