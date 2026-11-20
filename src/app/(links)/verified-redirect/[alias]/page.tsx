import { z } from "zod";

import { isPlatformRequest } from "@/components/link-status/branding";
import { ShortLinkAttribution } from "@/components/link-status/short-link-attribution";
import { noIndexMetadata } from "@/lib/seo/indexing";
import {
  buildBeaconScript,
  hashDestination,
  verifyVerifiedClickToken,
} from "@/lib/utils/verified-click-token";

import type { Metadata } from "next";

const redirectQuerySchema = z.object({
  to: z.string().optional(),
  t: z.string().min(1).optional(),
});

export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";

type VerifiedRedirectPageProps = {
  params: Promise<{ alias: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Redirecting...",
  ...noIndexMetadata,
};

function validateDestination(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function InvalidRedirect({ branded }: { branded: boolean }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <p className="text-gray-500">Invalid redirect</p>
      {branded && <ShortLinkAttribution campaign="verified_redirect" />}
    </div>
  );
}

export default async function VerifiedRedirectPage(props: VerifiedRedirectPageProps) {
  // The credit only appears where a visitor actually sees this page (the
  // invalid state and the no-JS fallback), never in the redirect itself.
  // Cloaked links resolve to the cloaked view instead of this page.
  const [searchParams, branded] = await Promise.all([props.searchParams, isPlatformRequest()]);
  const query = redirectQuerySchema.safeParse(searchParams).data;
  const to = validateDestination(query?.to ?? null);
  const rawToken = query?.t ?? null;

  // `to` must match the destination signed into the token at issue time.
  // Without this guard the page is an open redirect — any attacker-crafted
  // `?to=` would be obediently followed by window.location.replace.
  if (!to || !rawToken) return <InvalidRedirect branded={branded} />;
  const decoded = verifyVerifiedClickToken(rawToken);
  if (!decoded || decoded.destHash !== hashDestination(to)) {
    return <InvalidRedirect branded={branded} />;
  }

  const inline = `${buildBeaconScript(rawToken)}window.location.replace(${JSON.stringify(to)});`;

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <script dangerouslySetInnerHTML={{ __html: inline }} />
      <noscript>
        <p style={{ fontFamily: "sans-serif", padding: "1rem" }}>
          Redirecting... <a href={to}>continue</a>
        </p>
        {branded && <ShortLinkAttribution campaign="verified_redirect" />}
      </noscript>
    </>
  );
}
