import { UAParser } from "ua-parser-js";

import { env } from "@/env.mjs";
import { LOCAL_DEVELOPMENT_GEOLOCATION_DATA } from "@/lib/constants/app";
import { getClientIp } from "@/lib/platform";
import { resolveDeviceType } from "@/lib/utils/device-type";

import type { RouterOutputs } from "@/trpc/shared";

import type { GeolocationAPIResponseType } from "./types";

const getGeolocationDetailsFromAPI = async (ip: string) => {
  const geolocationApiUrl = `https://api.findip.net/ipHere/?token=${env.GEOLOCATION_API_KEY}`;
  // A lookup failure must not fail the click it decorates.
  try {
    const response = await fetch(geolocationApiUrl.replace("ipHere", ip));
    const data = (await response.json()) as Partial<GeolocationAPIResponseType>;

    return {
      city: data.city?.names?.en,
      country: data.country?.names?.en,
      continent: data.continent?.names?.en,
    };
  } catch {
    return {};
  }
};

const getGeolocationDetails = async (ip: string) => {
  const geolocationDetails = process.env.NODE_ENV === "production"
    ? await getGeolocationDetailsFromAPI(ip)
    : LOCAL_DEVELOPMENT_GEOLOCATION_DATA;

  return {
    city: geolocationDetails?.city ?? "Unknown",
    country: geolocationDetails?.country ?? "Unknown",
    continent: geolocationDetails?.continent ?? "Unknown",
  };
};

const identifyRequestingDevice = async (headers: Headers) => {
  const userAgent = headers.get("user-agent") ?? "";

  const result = await UAParser(userAgent, headers).withClientHints();

  const osName = result.os.name ?? "Unknown";

  return {
    browser: result.browser.name ?? "Unknown",
    os: osName,
    device: resolveDeviceType(osName, result.device.type),
    model: result.device.model ?? "Unknown",
  };
};

const getUserIP = (headers: Headers) => getClientIp(headers) ?? "127.0.0.1";

export const retrieveDeviceAndGeolocationData = async (headers: Headers) => {
  const [deviceDetails, geolocationDetails] = await Promise.all([
    identifyRequestingDevice(headers),
    getGeolocationDetails(getUserIP(headers)),
  ]);

  return {
    ...deviceDetails,
    ...geolocationDetails,
  };
};

function safeIncrement<T extends string>(
  record: Record<T, number>,
  key: T
): void {
  record[key] = (record[key] || 0) + 1;
}

type AggregateVisitsParams = {
  visits: RouterOutputs["link"]["linkVisits"]["totalVisits"];
  uniqueVisits: RouterOutputs["link"]["linkVisits"]["uniqueVisits"];
};

export const aggregateVisits = (
  visits: AggregateVisitsParams["visits"],
  uniqueVisits: AggregateVisitsParams["uniqueVisits"]
) => {
  const clicksPerDate: Record<string, number> = {};
  const uniqueClicksPerDate: Record<string, number> = {};
  const verifiedClicksPerDate: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerContinent: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};
  let totalClicks = 0;
  let verifiedClicks = 0;

  // biome-ignore lint/complexity/noForEach: <explanation>
  visits.forEach((visit) => {
    const date = new Date(visit.createdAt!).toISOString().split("T")[0];
    safeIncrement(clicksPerDate, date!);
    totalClicks += 1;

    if (visit.verifiedAt) {
      verifiedClicks += 1;
      safeIncrement(verifiedClicksPerDate, date!);
    }

    if (visit.country) safeIncrement(clicksPerCountry, visit.country);
    if (visit.city) safeIncrement(clicksPerCity, visit.city);
    if (visit.continent) safeIncrement(clicksPerContinent, visit.continent);
    if (visit.device) safeIncrement(clicksPerDevice, visit.device);
    if (visit.os) safeIncrement(clicksPerOS, visit.os);
    if (visit.browser) safeIncrement(clicksPerBrowser, visit.browser);
    if (visit.model) safeIncrement(clicksPerModel, visit.model);
  });

  if (!uniqueVisits)
    return {
      totalClicks,
      verifiedClicks,
      clicksPerDate,
      verifiedClicksPerDate,
      clicksPerCountry,
      clicksPerCity,
      clicksPerContinent,
      clicksPerDevice,
      clicksPerOS,
      clicksPerBrowser,
      clicksPerModel,
    };

  // biome-ignore lint/complexity/noForEach: <explanation>
  uniqueVisits.forEach((uniqueVisit) => {
    const date = new Date(uniqueVisit.createdAt!).toISOString().split("T")[0];
    safeIncrement(uniqueClicksPerDate, date!);
  });

  return {
    totalClicks,
    verifiedClicks,
    clicksPerDate,
    uniqueClicksPerDate,
    verifiedClicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerContinent,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  };
};

export type ArchivedClicks = {
  clicks: number;
  uniqueClicks: number;
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
};

// Raw visits older than the retention window are rolled up into daily
// summaries by the cleanup job. Only counts survive, so per-date series and
// totals can include them but country/device/referrer breakdowns cannot.
export const mergeArchivedClicks = (
  aggregated: { clicksPerDate: Record<string, number>; uniqueClicksPerDate?: Record<string, number> },
  archived: ArchivedClicks,
) => {
  const clicksPerDate = { ...aggregated.clicksPerDate };
  const uniqueClicksPerDate = { ...(aggregated.uniqueClicksPerDate ?? {}) };
  for (const [date, n] of Object.entries(archived.clicksPerDate)) {
    clicksPerDate[date] = (clicksPerDate[date] ?? 0) + n;
  }
  for (const [date, n] of Object.entries(archived.uniqueClicksPerDate)) {
    uniqueClicksPerDate[date] = (uniqueClicksPerDate[date] ?? 0) + n;
  }
  const sortByDate = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  return { clicksPerDate: sortByDate(clicksPerDate), uniqueClicksPerDate: sortByDate(uniqueClicksPerDate) };
};

export const summarizeArchived = (
  rows: { date: string; clicks: number; uniqueClicks: number }[],
): ArchivedClicks =>
  rows.reduce(
    (acc, s) => {
      acc.clicks += s.clicks;
      acc.uniqueClicks += s.uniqueClicks;
      acc.clicksPerDate[s.date] = (acc.clicksPerDate[s.date] ?? 0) + s.clicks;
      acc.uniqueClicksPerDate[s.date] = (acc.uniqueClicksPerDate[s.date] ?? 0) + s.uniqueClicks;
      return acc;
    },
    { clicks: 0, uniqueClicks: 0, clicksPerDate: {}, uniqueClicksPerDate: {} } as ArchivedClicks,
  );
