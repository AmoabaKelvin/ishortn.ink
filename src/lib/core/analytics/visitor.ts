import { UAParser } from "ua-parser-js";

import { getContinentName, getCountryFullName } from "@/lib/countries";
import { resolveDeviceType } from "@/lib/utils/device-type";

// Shared visitor-fingerprinting helpers used by every analytics recorder
// (link clicks, bio-page views). Keeping these in one place stops the click
// and view pipelines from drifting apart.

const isLocalhost = process.env.NODE_ENV === "development";

export type DeviceDetails = {
  browser: string;
  os: string;
  device: string;
  model: string;
};

/** Parse device/browser/OS details from request headers (UA + client hints). */
export async function parseDeviceDetails(headers: Headers): Promise<DeviceDetails> {
  const userAgent = headers.get("user-agent") ?? "";
  const parsed = await UAParser(userAgent, headers).withClientHints();
  const osName = parsed.os.name ?? "Unknown";
  return {
    browser: parsed.browser.name ?? "Unknown",
    os: osName,
    device: resolveDeviceType(osName, parsed.device.type),
    model: parsed.device.model ?? "Unknown",
  };
}

/** Resolve full country/continent/city names from raw geo codes. */
export function resolveGeo(country: string, city: string) {
  if (isLocalhost) {
    return {
      countryName: "United States",
      continentName: "North America",
      cityName: "San Francisco",
    };
  }

  if (!country || country === "undefined" || country === "Unknown") {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }

  try {
    return {
      countryName: getCountryFullName(country) ?? "Unknown",
      continentName: getContinentName(country) ?? "Unknown",
      cityName: city && city !== "undefined" && city !== "Unknown" ? city : "Unknown",
    };
  } catch {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }
}

/** Normalize a referer header into a coarse source label. */
export function parseReferrer(referrer: string | null): string {
  if (!referrer) return "direct";

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace(/^www\./, "");

    const referrerMap: Record<string, string> = {
      "t.co": "twitter",
      "l.facebook.com": "facebook",
      "lm.facebook.com": "facebook",
      "m.facebook.com": "facebook",
      "linkedin.com": "linkedin",
      "lnkd.in": "linkedin",
      "out.reddit.com": "reddit",
      "away.vk.com": "vkontakte",
      "com.google.android.gm": "gmail",
    };

    if (hostname in referrerMap) {
      return referrerMap[hostname] ?? hostname;
    }

    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return "unknown";
  }
}
