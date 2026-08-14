import { NextResponse } from "next/server";

import { scrapeMetadata } from "@/server/lib/metadata";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url query parameter is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await scrapeMetadata(url));
  } catch {
    return NextResponse.json({ error: "could not fetch metadata" }, { status: 422 });
  }
}
