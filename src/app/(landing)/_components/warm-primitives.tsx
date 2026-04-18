import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

// Default 16px size — prevents icons from expanding to fill flex containers
// when they're not inside a `.warm-btn` (which has its own svg sizing rule).
// Callers can still override via width/height props.
const baseProps = { width: 16, height: 16 } as const;

export const Icon = {
  Arrow: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ArrowUpRight: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <path
        d="M5 11L11 5M6 5h5v5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...p}
    >
      <path
        d="M3 8.5l3.5 3.5L13 4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Copy: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  ),
  Link: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <path
        d="M7 9a3 3 0 004.24 0l2.12-2.12a3 3 0 00-4.24-4.24L8 3.76"
        strokeLinecap="round"
      />
      <path
        d="M9 7a3 3 0 00-4.24 0L2.64 9.12a3 3 0 004.24 4.24L8 12.24"
        strokeLinecap="round"
      />
    </svg>
  ),
  Chart: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <path d="M2 13h12M4 11V7M7 11V4M10 11V8M13 11V5" strokeLinecap="round" />
    </svg>
  ),
  QR: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <path d="M9 9h2v2M13 9v2M9 13h2M13 13v1" strokeLinecap="round" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg
      {...baseProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...p}
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ),
  Star: (p: IconProps) => (
    <svg {...baseProps} viewBox="0 0 16 16" fill="currentColor" {...p}>
      <path d="M8 1l2.09 4.26L15 6l-3.5 3.4L12.3 14 8 11.7 3.7 14l.8-4.6L1 6l4.91-.74L8 1z" />
    </svg>
  ),
  Heart: (p: IconProps) => (
    <svg {...baseProps} viewBox="0 0 16 16" fill="currentColor" {...p}>
      <path d="M8 14s-6-4-6-8a3 3 0 016-1 3 3 0 016 1c0 4-6 8-6 8z" />
    </svg>
  ),
  Sparkle: (p: IconProps) => (
    <svg {...baseProps} viewBox="0 0 16 16" fill="currentColor" {...p}>
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" />
    </svg>
  ),
};

export const Logo = ({
  size = 22,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path
      d="M10 6c-3 0-5 2-5 5s2 5 5 5h12c3 0 5 2 5 5s-2 5-5 5"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="10" cy="11" r="2.5" fill={color} />
    <circle cx="22" cy="21" r="2.5" fill={color} />
  </svg>
);

export const Wordmark = ({ onInk = false }: { onInk?: boolean }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--font-warm-display)",
      fontSize: 24,
      fontWeight: 500,
      letterSpacing: "-0.02em",
    }}
  >
    <Logo
      size={24}
      color={onInk ? "var(--warm-paper)" : "var(--warm-ink)"}
    />
    <span>
      iShortn<span style={{ color: "var(--warm-accent)" }}>.</span>
    </span>
  </span>
);
