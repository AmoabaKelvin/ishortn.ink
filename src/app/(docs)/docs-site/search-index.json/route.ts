import { getDocsSearchIndex } from "@/lib/docs/content";

// Built once at deploy time; the docs search loads it on first open.
export const dynamic = "force-static";

export function GET() {
  return Response.json(getDocsSearchIndex());
}
