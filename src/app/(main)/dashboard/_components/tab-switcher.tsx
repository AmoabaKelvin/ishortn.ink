"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { name: "Links", href: "/dashboard" },
  { name: "API Keys", href: "/dashboard/tokens" },
  { name: "Billing", href: "/dashboard/settings/billing" },
  // {
  //   name: "Feature Requests",
  //   href: "https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link",
  // },
];

type TabSwitcherProps = {
  className?: string;
};

const TabSwitcher = ({ className }: TabSwitcherProps) => {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "border-1 flex items-center border-b  text-center text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      <ul className="-mb-px flex flex-wrap">
        {links.map(({ name, href }) => (
          <li key={name} className="me-2">
            <Link
              href={href}
              className={cn(
                "inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300",
                pathname === href && "border-blue-600 text-blue-600 dark:border-blue-500",
              )}
            >
              {name}
            </Link>
          </li>
        ))}
        <span
          className="relative inline-block rounded-t-lg border-b-2 border-transparent p-4 hover:cursor-pointer hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={() => rnw("show")}
        >
          <div className="rn-badge" />
          Release Notes
        </span>
      </ul>
    </div>
  );
};

export { TabSwitcher };

declare function rnw(...args: unknown[]): void;
