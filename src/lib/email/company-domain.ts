// Consumer mail providers, matched on the label before the public suffix so regional variants
// (yahoo.co.uk, hotmail.fr, gmx.de, yandex.ru) need no entry of their own.
const FREE_MAIL_PROVIDERS = new Set([
  "aol",
  "gmail",
  "gmx",
  "googlemail",
  "hotmail",
  "icloud",
  "live",
  "mail",
  "msn",
  "outlook",
  "proton",
  "protonmail",
  "rocketmail",
  "tutanota",
  "yahoo",
  "yandex",
  "ymail",
  "zoho",
]);

// Free-mail domains whose name is too generic for the provider list above.
const FREE_MAIL_DOMAINS = new Set([
  "126.com",
  "163.com",
  "comcast.net",
  "fastmail.com",
  "free.fr",
  "hey.com",
  "inbox.com",
  "libero.it",
  "mac.com",
  "me.com",
  "naver.com",
  "orange.fr",
  "pm.me",
  "qq.com",
  "sbcglobal.net",
  "t-online.de",
  "tuta.io",
  "verizon.net",
  "web.de",
]);

// Second-level labels under a country code (example.co.uk), where the provider is one label up.
const SECOND_LEVEL_SUFFIXES = new Set(["co", "com", "net", "org"]);

/**
 * The registrable domain of a company address (jane@eu.acme.com gives acme.com), or null for
 * free-mail providers and addresses without one. Used to offer a custom domain built on the
 * user's own company name.
 */
export function companyEmailDomain(email: string | null | undefined): string | null {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;
  if (FREE_MAIL_DOMAINS.has(domain)) return null;

  const labels = domain.split(".");
  const hasSecondLevelSuffix =
    labels.length >= 3 && SECOND_LEVEL_SUFFIXES.has(labels[labels.length - 2]!);
  const registrable = labels.slice(-(hasSecondLevelSuffix ? 3 : 2));
  const provider = registrable[0];
  return !provider || FREE_MAIL_PROVIDERS.has(provider) ? null : registrable.join(".");
}
