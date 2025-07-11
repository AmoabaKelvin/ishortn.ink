import { NextRequest } from "next/server";

import { recordUserClickForLink } from "@/middlewares/record-click";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get("domain");
  const alias = searchParams.get("alias")?.replace("/", "");
  const country = searchParams.get("country") ?? "Unknown";
  const city = searchParams.get("city") ?? "Unknown";
  const continent = searchParams.get("continent") ?? "Unknown";
  const ip = searchParams.get("ip") ?? "";

  console.log(
    `Processing link for domain: ${domain}, alias: ${alias}, country: ${country}, city: ${city}, continent: ${continent}, ip: ${ip}`
  );

  if (!domain || !alias) {
    return Response.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  try {
    const link = await recordUserClickForLink(
      request,
      domain,
      alias,
      ip,
      country,
      city,
      continent,
      true // skipAnalytics flag
    );

    if (!link) {
      console.log("Could not find the link you are looking for");
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    console.log("Link found:", link);

    // Redirect to password verification page for protected links
    if (link.passwordHash) {
      const verifyUrl = `${request.url.split('/api/link')[0]}/verify-password/${link.id}`;
      return Response.json({ url: verifyUrl });
    }

    // Record the click only for actual redirections (non-password protected links)
    await recordUserClickForLink(
      request,
      domain,
      alias,
      ip,
      country,
      city,
      continent,
      false // record analytics
    );

    return Response.json({ url: link.url });
  } catch (error) {
    console.error("Error processing link:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
