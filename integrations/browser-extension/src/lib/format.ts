export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;

/** "12 of 30 links this month", or "1,204 links this month" when unlimited. */
export const usageText = (used: number, limit: number | null): string =>
  limit === null
    ? `${pluralize(used, "link")} this month`
    : `${used.toLocaleString("en-US")} of ${pluralize(limit, "link")} this month`;

export const planName = (plan: string): string =>
  plan === "ultra" ? "Ultra" : plan === "pro" ? "Pro" : "Free";

/** Default for "Shorten automatically" until the user picks: paid plans on, Free off. */
export const defaultAutoShorten = (plan: string): boolean => plan === "pro" || plan === "ultra";

export const qrFileName = (url: string): string => {
  let slug = "link";
  try {
    const parsed = new URL(url);
    slug = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // keep the fallback
  }
  slug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `qr-${slug || "link"}.png`;
};
