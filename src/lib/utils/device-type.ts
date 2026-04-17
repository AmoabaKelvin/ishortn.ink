// Desktop/mobile classification for analytics. ua-parser-js only populates
// `device.type` for non-desktop user agents (mobile/tablet/smarttv/etc.), so
// we fall back to the OS name. Keys are matched case-insensitively so that
// future ua-parser-js casing changes (e.g. "Mac OS" → "macOS" between v1 and
// v2) don't silently degrade to "Unknown" again.

const DESKTOP_OS_NAMES = new Set([
  "macos",
  "mac os",
  "os x",
  "windows",
  "linux",
  "ubuntu",
  "debian",
  "fedora",
  "chrome os",
  "chromeos",
  "freebsd",
  "openbsd",
]);

const MOBILE_OS_NAMES = new Set(["ios", "android"]);

export function resolveDeviceType(
  osName: string | undefined | null,
  parserDeviceType: string | undefined | null,
): string {
  if (parserDeviceType) return parserDeviceType;
  if (!osName) return "Unknown";
  const key = osName.toLowerCase();
  if (MOBILE_OS_NAMES.has(key)) return "Mobile";
  if (DESKTOP_OS_NAMES.has(key)) return "Desktop";
  return "Unknown";
}
