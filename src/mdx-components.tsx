import Link from "next/link";

import { Callout } from "@/components/docs/callout";
import { CodeBlock } from "@/components/docs/code-block";
import { CodeGroup } from "@/components/docs/code-group";
import { ApiRateLimits, PlanLimits, PlanValue } from "@/components/docs/plan-limits";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

function DocsLink({ href = "", children, ...props }: ComponentProps<"a">) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

function DocsTable(props: ComponentProps<"table">) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table {...props} />
    </div>
  );
}

const components: MDXComponents = {
  a: DocsLink,
  pre: CodeBlock,
  table: DocsTable,
  Callout,
  CodeGroup,
  ApiRateLimits,
  PlanLimits,
  PlanValue,
};

// Used by @next/mdx for every MDX file (only content/docs today).
export function useMDXComponents(): MDXComponents {
  return components;
}
