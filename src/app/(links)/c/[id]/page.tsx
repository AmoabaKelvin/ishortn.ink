import { Funnel_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import { vcardDisplayName } from "@/lib/qr-generator/vcard";
import { noIndexMetadata } from "@/lib/seo/indexing";
import { getContactCard } from "@/server/lib/contact-card";

import { ContactCardView } from "./contact-card-view";

import type { Metadata } from "next";

// Read on every visit so edits to the card show at once.
export const dynamic = "force-dynamic";

const funnelSans = Funnel_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getContactCard((await params).id);
  return {
    ...noIndexMetadata,
    title: { absolute: card ? vcardDisplayName(card) : "Contact card not found" },
  };
}

export default async function ContactCardPage({ params }: Props) {
  const { id } = await params;
  const card = await getContactCard(id);
  if (!card) notFound();
  return <ContactCardView publicId={id} card={card} className={funnelSans.className} />;
}
