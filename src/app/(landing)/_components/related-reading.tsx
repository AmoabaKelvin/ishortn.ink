import { IconBookFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { Eyebrow, Section, SectionHeading } from "./site-primitives";

/** "Related reading" band of text links. Renders nothing when `links` is empty. */
export const RelatedReading = ({ links }: { links: { href: string; label: string }[] }) =>
  links.length > 0 && (
    <Section>
      <SectionHeading
        align="left"
        eyebrow={<Eyebrow icon={<IconBookFilled aria-hidden="true" />}>Guides</Eyebrow>}
        title="Related reading"
      />
      <ul className="mt-10 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-pretty text-base font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
