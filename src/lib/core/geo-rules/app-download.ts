import { normalizeDestinationUrl } from "@/lib/utils/destination-url";

export type AppStore = "appStore" | "playStore";

const STORE_HOSTS = {
  appStore: "apps.apple.com",
  playStore: "play.google.com",
} satisfies Record<AppStore, string>;

const STORE_OS = {
  appStore: "ios",
  playStore: "android",
} satisfies Record<AppStore, string>;

const STORE_ERRORS = {
  appStore: "Enter an App Store link on apps.apple.com",
  playStore: "Enter a Google Play link on play.google.com",
} satisfies Record<AppStore, string>;

export type AppDownloadInput = {
  appStoreUrl: string;
  playStoreUrl: string;
  fallbackUrl: string;
};

export type AppDownloadErrors = Partial<Record<keyof AppDownloadInput, string>>;

export type AppDownloadRule = {
  type: "os";
  condition: "in";
  values: string[];
  action: "redirect";
  destination: string;
};

export type AppDownloadPreset =
  | { ok: true; destination: string; rules: AppDownloadRule[] }
  | { ok: false; errors: AppDownloadErrors };

function parseHttpUrl(input: string): URL | null {
  const normalized = normalizeDestinationUrl(input);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** Returns the normalized store URL, or null when it isn't on that store's host. */
export function parseStoreUrl(store: AppStore, input: string): string | null {
  const url = parseHttpUrl(input);
  if (!url || url.hostname.toLowerCase() !== STORE_HOSTS[store]) return null;
  // The store home page has no app to install.
  if (url.pathname === "/" || url.pathname === "") return null;
  url.protocol = "https:";
  return url.toString();
}

/** Which store a destination URL belongs to, used to prefill the preset from the link's URL. */
export function detectAppStore(input: string): AppStore | null {
  if (parseStoreUrl("appStore", input)) return "appStore";
  if (parseStoreUrl("playStore", input)) return "playStore";
  return null;
}

/**
 * Turns the preset fields into the link destination (the fallback for every other visitor) and
 * one OS rule per store. Both stores and the fallback are required; a fallback pointing at a
 * store would strand visitors on the wrong platform, so it must be a website.
 */
export function buildAppDownloadPreset(input: AppDownloadInput): AppDownloadPreset {
  const errors: AppDownloadErrors = {};

  const appStore = parseStoreUrl("appStore", input.appStoreUrl);
  if (!appStore) errors.appStoreUrl = STORE_ERRORS.appStore;

  const playStore = parseStoreUrl("playStore", input.playStoreUrl);
  if (!playStore) errors.playStoreUrl = STORE_ERRORS.playStore;

  const fallback = parseHttpUrl(input.fallbackUrl)
    ? normalizeDestinationUrl(input.fallbackUrl)
    : null;
  if (!fallback) {
    errors.fallbackUrl = "Enter a website URL, e.g. https://example.com";
  } else if (detectAppStore(fallback)) {
    errors.fallbackUrl = "Use a website, not a store link, for other devices";
  }

  if (!appStore || !playStore || !fallback || errors.fallbackUrl) return { ok: false, errors };

  return {
    ok: true,
    destination: fallback,
    rules: [
      {
        type: "os",
        condition: "in",
        values: [STORE_OS.appStore],
        action: "redirect",
        destination: appStore,
      },
      {
        type: "os",
        condition: "in",
        values: [STORE_OS.playStore],
        action: "redirect",
        destination: playStore,
      },
    ],
  };
}

type AppStoreRuleCandidate = {
  type: string;
  condition: string;
  values: string[];
  destination?: string | null;
};

/**
 * True for an OS rule that only sends iOS and/or Android somewhere, which the preset replaces
 * when it is applied again instead of stacking duplicates.
 */
export function isAppStoreRule(rule: AppStoreRuleCandidate) {
  return (
    rule.type === "os" &&
    rule.condition === "in" &&
    rule.values.length > 0 &&
    rule.values.every((value) => value === STORE_OS.appStore || value === STORE_OS.playStore)
  );
}

/**
 * The store links of an app download setup already in the rules, so the preset can be edited
 * instead of added again. Null until both an iPhone and an Android rule point at their store.
 */
export function findAppDownloadRules(
  rules: AppStoreRuleCandidate[],
): Pick<AppDownloadInput, "appStoreUrl" | "playStoreUrl"> | null {
  let appStoreUrl: string | undefined;
  let playStoreUrl: string | undefined;
  for (const rule of rules) {
    if (!isAppStoreRule(rule) || !rule.destination) continue;
    if (rule.values.includes(STORE_OS.appStore) && parseStoreUrl("appStore", rule.destination)) {
      appStoreUrl ??= rule.destination;
    }
    if (rule.values.includes(STORE_OS.playStore) && parseStoreUrl("playStore", rule.destination)) {
      playStoreUrl ??= rule.destination;
    }
  }
  return appStoreUrl && playStoreUrl ? { appStoreUrl, playStoreUrl } : null;
}

/** Applying the preset again replaces its earlier store rules instead of stacking duplicates. */
export function replaceAppStoreRules<T extends AppStoreRuleCandidate>(
  rules: T[],
  presetRules: T[],
): T[] {
  return [...rules.filter((rule) => !isAppStoreRule(rule)), ...presetRules];
}
