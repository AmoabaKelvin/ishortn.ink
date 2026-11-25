export type PlatformOs = "mac" | "win" | "linux" | "cros" | "android" | "openbsd" | "fuchsia" | string;

const LABEL_MAX = 64;

const browserFromUa = (ua: string): string => {
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/\bOPR\//.test(ua)) return "Opera";
  if (/\bVivaldi\//.test(ua)) return "Vivaldi";
  if (/\bFirefox\//.test(ua)) return "Firefox";
  if (/\bChrom(e|ium)\//.test(ua)) return "Chrome";
  if (/\bSafari\//.test(ua)) return "Safari";
  return "Browser";
};

const osFromPlatform = (os: PlatformOs | undefined): string | null => {
  switch (os) {
    case "mac":
      return "macOS";
    case "win":
      return "Windows";
    case "linux":
      return "Linux";
    case "cros":
      return "ChromeOS";
    case "android":
      return "Android";
    case "openbsd":
      return "OpenBSD";
    default:
      return null;
  }
};

const osFromUa = (ua: string): string | null => {
  if (/\bCrOS\b/.test(ua)) return "ChromeOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux|X11/.test(ua)) return "Linux";
  return null;
};

/** Label shown in Settings → Connected browsers, e.g. "Chrome on macOS". */
export const browserLabel = (ua: string, platformOs?: PlatformOs): string => {
  const browser = browserFromUa(ua);
  const os = osFromPlatform(platformOs) ?? osFromUa(ua);
  const label = os ? `${browser} on ${os}` : browser;
  return label.slice(0, LABEL_MAX);
};
