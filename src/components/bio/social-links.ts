// Turn whatever someone types for a social link — a bare handle ("@me"), an
// email, a bare domain, or a full URL — into a canonical, safe href. The bio
// editor accepts loose input and this is the single place that canonicalizes it.

// For each handle-style platform: how a bare handle becomes a profile URL, and
// the hostnames that signal the user pasted a full URL instead of a handle.
const PLATFORM_LINKS: Record<string, { base: (handle: string) => string; hosts: string[] }> = {
  twitter: { base: (h) => `https://x.com/${h}`, hosts: ["twitter.com", "x.com"] },
  instagram: { base: (h) => `https://instagram.com/${h}`, hosts: ["instagram.com"] },
  tiktok: { base: (h) => `https://tiktok.com/@${h}`, hosts: ["tiktok.com"] },
  youtube: { base: (h) => `https://youtube.com/@${h}`, hosts: ["youtube.com", "youtu.be"] },
  facebook: { base: (h) => `https://facebook.com/${h}`, hosts: ["facebook.com", "fb.com"] },
  linkedin: { base: (h) => `https://linkedin.com/in/${h}`, hosts: ["linkedin.com"] },
  github: { base: (h) => `https://github.com/${h}`, hosts: ["github.com"] },
  telegram: { base: (h) => `https://t.me/${h}`, hosts: ["t.me", "telegram.me"] },
  threads: { base: (h) => `https://threads.net/@${h}`, hosts: ["threads.net"] },
  twitch: { base: (h) => `https://twitch.tv/${h}`, hosts: ["twitch.tv"] },
  snapchat: { base: (h) => `https://snapchat.com/add/${h}`, hosts: ["snapchat.com"] },
  whatsapp: { base: (h) => `https://wa.me/${h.replace(/[^0-9]/g, "")}`, hosts: ["wa.me", "whatsapp.com"] },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only http(s) and mailto are renderable hrefs we want to emit.
function asSafeUrl(value: string): string | null {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:" ? value : null;
  } catch {
    return null;
  }
}

export function normalizeSocialUrl(platform: string, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Already a full link — keep it as written (after a safety check).
  if (/^https?:\/\//i.test(value)) return asSafeUrl(value);
  if (/^mailto:/i.test(value)) return asSafeUrl(value);

  if (platform === "email") {
    return EMAIL_RE.test(value) ? `mailto:${value}` : null;
  }

  if (platform === "website") {
    return asSafeUrl(`https://${value.replace(/^\/+/, "")}`);
  }

  const config = PLATFORM_LINKS[platform];
  if (config) {
    const lower = value.toLowerCase();
    // Pasted the platform's own host without a scheme → treat it as a URL.
    if (config.hosts.some((host) => lower.startsWith(host) || lower.startsWith(`www.${host}`))) {
      return asSafeUrl(`https://${value.replace(/^\/+/, "")}`);
    }
    // Otherwise it's a handle: drop a leading @ and stray slashes.
    const handle = value.replace(/^@+/, "").replace(/^\/+|\/+$/g, "");
    return handle ? asSafeUrl(config.base(handle)) : null;
  }

  // Unknown platform: best effort.
  return asSafeUrl(`https://${value.replace(/^\/+/, "")}`);
}
