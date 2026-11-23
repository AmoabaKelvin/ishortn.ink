import { buildLlmsTxt } from "@/lib/seo/llms-txt";

// Hourly, like the sitemap, so a scheduled blog post joins the Guides list on its date.
export const revalidate = 3600;

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
