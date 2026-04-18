import type { Metadata } from "next";

import {
  buildBeaconScript,
  hashDestination,
  verifyVerifiedClickToken,
} from "@/lib/utils/verified-click-token";

export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";

type VerifiedRedirectPageProps = {
  params: Promise<{ alias: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Redirecting...",
  robots: { index: false, follow: false },
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

function InvalidRedirect() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <p className="text-gray-500">Invalid redirect</p>
    </div>
  );
}

export default async function VerifiedRedirectPage(
  props: VerifiedRedirectPageProps,
) {
  const searchParams = await props.searchParams;
  const to = validateDestination(
    typeof searchParams.to === "string" ? searchParams.to : null,
  );
  const rawToken =
    typeof searchParams.t === "string" && searchParams.t.length > 0
      ? searchParams.t
      : null;

  // `to` must match the destination signed into the token at issue time.
  // Without this guard the page is an open redirect — any attacker-crafted
  // `?to=` would be obediently followed by window.location.replace.
  if (!to || !rawToken) return <InvalidRedirect />;
  const decoded = verifyVerifiedClickToken(rawToken);
  if (!decoded || decoded.destHash !== hashDestination(to)) {
    return <InvalidRedirect />;
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
      </noscript>
    </>
  );
}
