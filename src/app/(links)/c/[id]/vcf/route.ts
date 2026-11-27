import { serializeVCard, vcardAttachmentHeader } from "@/lib/qr-generator/vcard";
import { NO_INDEX_HEADER } from "@/lib/seo/indexing";
import { getContactCard } from "@/server/lib/contact-card";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const card = await getContactCard((await params).id);
  if (!card) {
    return new Response("Contact card not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": NO_INDEX_HEADER },
    });
  }
  return new Response(serializeVCard(card), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": vcardAttachmentHeader(card),
      // Edits must show on the next download.
      "Cache-Control": "no-store",
      "X-Robots-Tag": NO_INDEX_HEADER,
    },
  });
}
