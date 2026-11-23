import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { appRouter } from "@/server/api/root";
import { storedQrImageSource } from "@/server/api/routers/qrcode/utils";
import { createTRPCContext } from "@/server/api/trpc";

import type { RouterOutputs } from "@/trpc/shared";
import type { NextRequest } from "next/server";

const log = logger.child({ component: "api.qr-code-png" });

export const dynamic = "force-dynamic";

/**
 * Same-origin download of a QR code's stored image. The R2 public bucket sends no CORS headers, so
 * the dashboard can neither fetch the image nor save it with `download`.
 *
 * GET /api/qr-codes/:id/png
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "QR code not found." }, { status: 404 });
  }

  // The tRPC procedure applies the session, ban and workspace checks and scopes the lookup.
  let qr: RouterOutputs["qrCode"]["get"];
  try {
    const ctx = await createTRPCContext({ auth: await auth(), headers: request.headers });
    qr = await appRouter.createCaller(ctx).qrCode.get({ id });
  } catch (error) {
    if (error instanceof TRPCError) {
      return NextResponse.json(
        { error: error.message },
        { status: getHTTPStatusCodeFromError(error) },
      );
    }
    log.error({ err: error, qrCodeId: id }, "QR code lookup failed");
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  const source = storedQrImageSource(qr);
  if (!source) {
    return NextResponse.json({ error: "QR code image is not available." }, { status: 404 });
  }

  const headers = {
    "Content-Disposition": `attachment; filename="qr-code-${qr.id}.png"`,
    "Cache-Control": "private, no-store",
  };

  if (source.type === "inline") {
    return new Response(new Uint8Array(source.bytes), {
      headers: { ...headers, "Content-Type": source.contentType },
    });
  }

  try {
    const upstream = await fetch(source.url);
    if (!upstream.ok || !upstream.body) throw new Error(`HTTP ${upstream.status}`);
    return new Response(upstream.body, {
      headers: { ...headers, "Content-Type": upstream.headers.get("Content-Type") ?? "image/png" },
    });
  } catch (error) {
    log.warn({ err: error, qrCodeId: qr.id }, "stored QR code image fetch failed");
    return NextResponse.json({ error: "QR code image is not available." }, { status: 502 });
  }
}
