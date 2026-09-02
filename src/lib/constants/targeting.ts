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
      return value.toLowerCase() in DEVICE_TYPES;
    case "os":
      return value.toLowerCase() in OS_TYPES;
  }
}

// ua-parser-js OS names collapsed onto OS_TYPES keys. Linux distributions
// fold into "linux"; anything unlisted matches no rule.
const OS_ALIASES: Record<string, keyof typeof OS_TYPES> = {
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
};

export function normalizeOsName(osName: string | null | undefined): string | null {
  if (!osName) return null;
  return OS_ALIASES[osName.toLowerCase()] ?? null;
}
