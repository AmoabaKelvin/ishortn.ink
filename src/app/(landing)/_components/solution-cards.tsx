import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { solutionList } from "@/lib/seo/solutions";
import { cn } from "@/lib/utils";

import { bodyClass, cardClass, h3Class, IconPlate } from "./site-primitives";

/** One linked card per solution: the /solutions hub grid, reused on /features. */
export const SolutionCards = ({ headingLevel: Heading = "h2" }: { headingLevel?: "h2" | "h3" }) => (
  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {solutionList.map((solution) => (
      <li key={solution.slug} className="flex">
        <Link
          href={`/solutions/${solution.slug}`}
          className={cn(
            cardClass,
            "flex w-full flex-col p-6 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
          )}
        >
          <IconPlate>
            <solution.icon aria-hidden="true" />
          </IconPlate>
          <Heading className={cn(h3Class, "mt-6 text-balance")}>{solution.name}</Heading>
          <p className={cn(bodyClass, "mt-2")}>{solution.hubBlurb}</p>
          <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
            See how it works
            <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
          </span>
        </Link>
      </li>
    ))}
  </ul>
);
