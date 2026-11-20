import { notFound } from "next/navigation";

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

  return <LinkPasswordVerification id={id} />;
}
