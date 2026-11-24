declare const __ISHORTN_BASE_URL__: string | undefined;

// Replaced at build time by esbuild `define`; tests and type checks fall back to production.
export const BASE_URL: string = (
  typeof __ISHORTN_BASE_URL__ === "string" && __ISHORTN_BASE_URL__
    ? __ISHORTN_BASE_URL__
    : "https://ishortn.ink"
).replace(/\/+$/, "");

const UTM = "utm_source=browser-extension&utm_medium=integration";

export const urls = {
  dashboard: (base = BASE_URL) => `${base}/dashboard`,
  settings: (base = BASE_URL) => `${base}/dashboard/settings#connected-browsers`,
  connect: (base: string, redirectUri: string, state: string, label: string) =>
    `${base}/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}&label=${encodeURIComponent(label)}`,
  signUp: (base: string, tabUrl: string | null) => {
    const target = tabUrl ? `url=${encodeURIComponent(tabUrl)}&` : "";
    return `${base}/auth/sign-up?${target}${UTM}&utm_campaign=extension_signup`;
  },
};
