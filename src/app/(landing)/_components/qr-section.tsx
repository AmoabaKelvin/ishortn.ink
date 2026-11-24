import { encode } from "uqr";

import { cn } from "@/lib/utils";

import { QRStyleDemo } from "./qr-style-demo";
import { SiteIcon } from "./site-icon";
import { bodyClass, ButtonLink, Eyebrow, Section, SectionHeading } from "./site-primitives";

const QR_TEXT = "https://ishortn.ink/dashboard";

// ECC H so the center logo overlay doesn't break scans. Encoded on the server, once per process:
// the encoder and its mask scoring stay out of the page's JavaScript, which matters on slow phones.
const QR_ROWS = encode(QR_TEXT, { ecc: "H", border: 0 }).data.map((row) =>
  row.map((dark) => (dark ? "1" : "0")).join(""),
);

export const QRSection = () => (
  <Section>
    <QRStyleDemo
      rows={QR_ROWS}
      text={QR_TEXT}
      intro={
        <>
          <SectionHeading
            align="left"
            eyebrow={<Eyebrow icon={<SiteIcon name="qrcode" />}>QR codes</Eyebrow>}
            title="QR codes that match your brand"
            subtitle="Pick a shape, add your logo, and use your own colors. Download a PNG that's ready for posters, packaging, or menus."
          />
          <p className={cn(bodyClass, "mt-4 max-w-[52ch]")}>
            Free includes 5 dynamic QR codes: change the destination any time without reprinting,
            they never expire, and there are no ads. Pro adds branded codes. Every scan is tracked.
          </p>
        </>
      }
      action={
        <ButtonLink variant="secondary" href="/dashboard/qrcodes/create">
          Create a QR code
        </ButtonLink>
      }
    />
  </Section>
);
