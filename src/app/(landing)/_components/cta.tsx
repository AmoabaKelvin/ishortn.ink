import { IconCheck } from "@tabler/icons-react";

import { Paths } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import { ButtonLink, h2Class, leadClass, panelClass, Section } from "./site-primitives";

const reassurances = ["Free forever plan", "No credit card required", "Cancel anytime"];

export const CTA = ({
  title = "Smarter, simpler link sharing",
  body,
  primaryHref = Paths.Signup,
  primaryLabel = "Get started",
  points = reassurances,
}: {
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
  points?: string[];
}) => (
  <Section className="px-3 py-3 sm:px-3 sm:py-3 xl:px-3">
    <div className={cn(panelClass, "relative overflow-hidden px-6 py-24 text-center sm:py-32")}>
      <div aria-hidden="true" className="site-tiles absolute inset-0" />
      <div className="relative">
        <h2 className={cn(h2Class, "mx-auto max-w-[20ch]")}>{title}</h2>
        {body && <p className={cn(leadClass, "mx-auto mt-5 max-w-[52ch]")}>{body}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink size="lg" href={primaryHref}>
            {primaryLabel}
          </ButtonLink>
          <ButtonLink size="lg" variant="soft" href="/pricing">
            View pricing
          </ButtonLink>
        </div>
        {points.length > 0 && <CheckList items={points} className="mt-8" />}
      </div>
    </div>
  </Section>
);

/** Row of short check-marked reassurances under a pair of buttons. */
export const CheckList = ({ items, className }: { items: string[]; className?: string }) => (
  <ul
    className={cn(
      "flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-neutral-600 sm:text-sm",
      className,
    )}
  >
    {items.map((item) => (
      <li key={item} className="flex items-center gap-1.5">
        <IconCheck aria-hidden="true" className="size-4 shrink-0 text-neutral-900" />
        {item}
      </li>
    ))}
  </ul>
);
