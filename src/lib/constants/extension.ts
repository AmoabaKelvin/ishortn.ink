// The iShortn browser extension's Chrome Web Store listing. Every store link is built from this.
export const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/ishortn-url-shortener-qr/opkikfbhepmnlnblmjnfjgjeonadekdj";

// Store link for the marketing site; the store reports installs by utm_source and utm_campaign.
export const CHROME_WEB_STORE_SITE_URL = `${CHROME_WEB_STORE_URL}?${new URLSearchParams({
  utm_source: "ishortn",
  utm_medium: "site",
  utm_campaign: "extension",
}).toString()}`;
