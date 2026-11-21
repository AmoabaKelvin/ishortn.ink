import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { isPlatformRequest } from "@/components/link-status/branding";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";

import { LinkPasswordVerification } from "../../[linkAlias]/link-password-verification";

type VerifyPasswordPageProps = {
  params: Promise<{
    linkId: string;
  }>;
};

export default async function VerifyPasswordPage({ params }: VerifyPasswordPageProps) {
  const { linkId } = await params;
  const id = Number(linkId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [isPlatform, linkRecord] = await Promise.all([
    isPlatformRequest(),
    db.query.link.findFirst({ where: eq(link.id, id), columns: { cloaking: true } }),
  ]);

  return (
    <LinkPasswordVerification
      id={id}
      branded={isPlatform && !!linkRecord && !linkRecord.cloaking}
    />
  );
}
