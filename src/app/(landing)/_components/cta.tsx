import { IconCheck } from "@tabler/icons-react";

import { Paths } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import { ButtonLink, h2Class, panelClass, Section } from "./site-primitives";

const reassurances = ["Free forever plan", "No credit card required", "Cancel anytime"];

export const CTA = () => (
  <Section className="px-3 py-3 sm:px-3 sm:py-3 xl:px-3">
    <div className={cn(panelClass, "relative overflow-hidden px-6 py-24 text-center sm:py-32")}>
      <div aria-hidden="true" className="site-tiles absolute inset-0" />
      <div className="relative">
        <h2 className={cn(h2Class, "mx-auto max-w-[20ch]")}>Smarter, simpler link sharing</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink size="lg" href={Paths.Signup}>
            Get started
          </ButtonLink>
          <ButtonLink size="lg" variant="soft" href="/pricing">
            View pricing
          </ButtonLink>
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-neutral-600 sm:text-sm">
          {reassurances.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <IconCheck aria-hidden="true" className="size-4 shrink-0 text-neutral-900" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Section>
);
