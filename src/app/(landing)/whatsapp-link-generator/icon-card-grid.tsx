import { cn } from "@/lib/utils";

import { bodyClass, cardClass, h3Class, IconPlate } from "../_components/site-primitives";

import type { ReactNode } from "react";

export type IconCard = { title: string; body: string; icon: ReactNode };

/** The ideas and short-link feature cards on the WhatsApp link generator pages. */
export const IconCardGrid = ({ items }: { items: IconCard[] }) => (
  <dl className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.title} className={cn(cardClass, "p-6 sm:p-8")}>
        <IconPlate>{item.icon}</IconPlate>
        <dt className={cn(h3Class, "mt-6")}>{item.title}</dt>
        <dd className={cn(bodyClass, "mt-2 sm:text-sm")}>{item.body}</dd>
      </div>
    ))}
  </dl>
);
