import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { cn } from "@/lib/utils";

import type { ComponentProps, ReactNode } from "react";

// Shared building blocks for the marketing + auth theme.
// Design language: docs/design-language.md

/* ------------------------------ Brand ------------------------------ */

export const Logo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={cn("size-6 shrink-0", className)}
  >
    <path
      d="M10 6c-3 0-5 2-5 5s2 5 5 5h12c3 0 5 2 5 5s-2 5-5 5"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
    />
    <circle cx="10" cy="11" r="2.5" fill="currentColor" />
    <circle cx="22" cy="21" r="2.5" fill="currentColor" />
  </svg>
);

export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 font-title text-[1.375rem] font-bold tracking-[-0.03em] text-neutral-900",
      className,
    )}
  >
    <Logo />
    iShortn
  </span>
);

/* --------------------------- Typography ---------------------------- */

// One place to tune the display voice: Google Sans, semibold, tight tracking.
export const titleClass = "font-title font-semibold tracking-[-0.025em] text-neutral-900";
export const h1Class = cn(titleClass, "text-balance text-[2.75rem] leading-[1.05] sm:text-6xl");
export const h2Class = cn(titleClass, "text-balance text-4xl sm:text-5xl");
// Card / feature titles
export const h3Class = "font-title text-xl font-semibold tracking-[-0.02em] text-neutral-900";
export const leadClass = "text-pretty text-lg text-neutral-600";
export const bodyClass = "text-pretty text-base text-neutral-600";

/* ----------------------------- Surfaces ---------------------------- */

// White card on the gray canvas. Ring is baked into the shadow token.
export const cardClass = "rounded-2xl bg-white shadow-site-card";
// Big hero / CTA panels
export const panelClass = "rounded-3xl bg-white shadow-site-card";
// Recessed well inside a card (mock UI backgrounds, chips)
export const wellClass = "rounded-xl bg-neutral-100";

/* ----------------------------- Buttons ----------------------------- */

type ButtonVariant = "primary" | "secondary" | "soft";
type ButtonSize = "md" | "lg";

export const buttonClass = ({
  variant = "primary",
  size = "md",
  arrow = false,
}: { variant?: ButtonVariant; size?: ButtonSize; arrow?: boolean } = {}) =>
  cn(
    "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] font-medium",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
    "disabled:pointer-events-none disabled:opacity-60",
    size === "md" && "text-base sm:text-sm",
    size === "md" && (arrow ? "py-2 pl-3.5 pr-2" : "px-3.5 py-2"),
    size === "lg" && "text-base",
    size === "lg" && (arrow ? "py-2.5 pl-4 pr-2.5" : "px-4 py-2.5"),
    variant === "primary" &&
      "bg-neutral-900 text-white shadow-site-btn-primary hover:bg-neutral-800",
    variant === "secondary" && "bg-white text-neutral-900 shadow-site-btn hover:bg-neutral-50",
    variant === "soft" && "bg-neutral-950/[0.06] text-neutral-900 hover:bg-neutral-950/10",
  );

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing chevron — the default CTA shape on marketing pages */
  arrow?: boolean;
};

export const ButtonLink = ({
  variant,
  size,
  arrow = true,
  className,
  children,
  ...props
}: ButtonLinkProps) => (
  <Link className={cn(buttonClass({ variant, size, arrow }), className)} {...props}>
    {children}
    {arrow && <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />}
  </Link>
);

/* ------------------------- Section scaffold ------------------------ */

const hairline = "border-neutral-950/[0.07]";

/**
 * A page band. Draws the full-bleed top hairline, the container's vertical
 * hairlines, and the "+" marks where they cross. Every marketing section
 * goes through this so content edges and the blueprint frame line up.
 */
export const Section = ({
  id,
  className,
  children,
}: {
  id?: string;
  /** Vertical padding override, e.g. "py-10" for slim bands */
  className?: string;
  children: ReactNode;
}) => (
  <section id={id} className={cn("relative scroll-mt-24 border-t", hairline)}>
    <div
      className={cn(
        "relative mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28 xl:border-x xl:px-16",
        hairline,
        className,
      )}
    >
      <span aria-hidden="true" className="site-plus -left-[11px] -top-[11px] hidden xl:block" />
      <span aria-hidden="true" className="site-plus -right-[11px] -top-[11px] hidden xl:block" />
      {children}
    </div>
  </section>
);

/** Small white pill that sits above a section headline. `icon` is a 16px Tabler icon. */
export const Eyebrow = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full bg-white text-[0.8125rem] font-medium text-neutral-800 shadow-site-btn [&>svg]:size-4 [&>svg]:shrink-0",
      icon ? "py-1 pl-1.5 pr-2.5" : "px-2.5 py-1",
    )}
  >
    {icon}
    {children}
  </span>
);

export const SectionHeading = ({
  eyebrow,
  title,
  subtitle,
  actions,
  align = "center",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  align?: "center" | "left";
}) => {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col", centered ? "items-center text-center" : "items-start")}>
      {eyebrow}
      <h2 className={cn(h2Class, "max-w-[24ch]", eyebrow && "mt-5")}>{title}</h2>
      {subtitle && <p className={cn(leadClass, "mt-4 max-w-[52ch]")}>{subtitle}</p>}
      {actions && (
        <div className={cn("mt-7 flex flex-wrap gap-3", centered && "justify-center")}>
          {actions}
        </div>
      )}
    </div>
  );
};

/* --------------------------- Small pieces -------------------------- */

/** Mono "01" chip used on step cards */
export const StepChip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex rounded-md bg-neutral-950/[0.06] px-1.5 py-0.5 font-mono text-sm font-medium text-neutral-600">
    {children}
  </span>
);

/** Raised icon plate with four "screw" dots. `children` is a 24px filled Tabler icon. */
export const IconPlate = ({ children }: { children: ReactNode }) => (
  <span className="relative grid size-14 shrink-0 place-items-center rounded-[14px] bg-gradient-to-b from-white to-neutral-100 text-neutral-800 shadow-site-card [&>svg]:size-6">
    {["left-1.5 top-1.5", "right-1.5 top-1.5", "bottom-1.5 left-1.5", "bottom-1.5 right-1.5"].map(
      (pos) => (
        <i key={pos} className={cn("absolute size-[3px] rounded-full bg-neutral-300", pos)} />
      ),
    )}
    {children}
  </span>
);
