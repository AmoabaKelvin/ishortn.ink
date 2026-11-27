// Mailbox providers and relays whose domain isn't the user's own, so it can't become `links.<domain>`.
const SHARED_EMAIL_DOMAINS = new Set([
  "126.com",
  "163.com",
  "aim.com",
  "aol.com",
  "duck.com",
  "fastmail.com",
  "gmail.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "googlemail.com",
  "hey.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mac.com",
  "mail.com",
  "mail.ru",
  "me.com",
  "msn.com",
  "naver.com",
  "outlook.com",
  "pm.me",
  "privaterelay.appleid.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "rocketmail.com",
  "tutanota.com",
  "web.de",
  "yahoo.com",
  "yandex.com",
  "yandex.ru",
  "ymail.com",
  "zoho.com",
]);

// Regional variants (hotmail.co.uk, yahoo.fr, outlook.com.br, ...).
const SHARED_EMAIL_PROVIDER = /^(hotmail|live|outlook|yahoo|gmx|yandex|libero|orange|wanadoo)\./;

// Students and staff don't own these domains.
const INSTITUTION_DOMAIN = /\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2})$/;

/** The domain of a work email, or null for shared mailbox providers and institutions. */
export function workEmailDomain(email: string | null | undefined): string | null {
  const domain = email?.trim().toLowerCase().split("@").at(-1);
  if (!domain || !email?.includes("@") || !domain.includes(".")) return null;
  if (SHARED_EMAIL_DOMAINS.has(domain) || SHARED_EMAIL_PROVIDER.test(domain)) return null;
  if (INSTITUTION_DOMAIN.test(domain)) return null;
  return domain;
}
