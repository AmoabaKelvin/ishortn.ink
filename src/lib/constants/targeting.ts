import { lookup } from "@/lib/utils/lookup";

export const DEVICE_TYPES = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
} as const;

export const OS_TYPES = {
  ios: "iOS",
  android: "Android",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  chromeos: "ChromeOS",
} as const;

export type TargetingRuleType = "country" | "continent" | "device" | "os";

const COUNTRY_CODE = /^[A-Z]{2}$/i;

export function isValidTargetingValue(type: TargetingRuleType, value: string): boolean {
  switch (type) {
    case "country":
    case "continent":
      return COUNTRY_CODE.test(value);
    case "device":
      return Object.hasOwn(DEVICE_TYPES, value.toLowerCase());
    case "os":
      return Object.hasOwn(OS_TYPES, value.toLowerCase());
  }
}

// ua-parser-js OS names collapsed onto OS_TYPES keys. Linux distributions
// fold into "linux"; anything unlisted matches no rule.
const OS_ALIASES = {
  ios: "ios",
  android: "android",
  windows: "windows",
  macos: "macos",
  "mac os": "macos",
  "os x": "macos",
  linux: "linux",
  ubuntu: "linux",
  debian: "linux",
  fedora: "linux",
  mint: "linux",
  arch: "linux",
  manjaro: "linux",
  gentoo: "linux",
  suse: "linux",
  "red hat": "linux",
  centos: "linux",
  chromeos: "chromeos",
  "chrome os": "chromeos",
  "chromium os": "chromeos",
} satisfies Record<string, keyof typeof OS_TYPES>;

export function normalizeOsName(osName: string | null | undefined): string | null {
  if (!osName) return null;
  return lookup(OS_ALIASES, osName.toLowerCase()) ?? null;
}
