import UAParser from "ua-parser-js";

import { env } from "@/env.mjs";
import { LOCAL_DEVELOPMENT_GEOLOCATION_DATA } from "@/lib/constants";

import type { RouterOutputs } from "@/trpc/shared";

import type { GeolocationAPIResponseType } from "./types";

const getGeolocationDetailsFromAPI = async (ip: string) => {
  const geolocationApiUrl = `https://api.findip.net/ipHere/?token=${env.GEOLOCATION_API_KEY}`;
  const response = await fetch(geolocationApiUrl.replace("ipHere", ip));
  const data = (await response.json()) as GeolocationAPIResponseType;

  return {
    city: data.city.names.en,
    country: data.country.names.en,
  };
};

const getGeolocationDetails = async (ip: string) => {
  const geolocationDetails = process.env.VERCEL
    ? await getGeolocationDetailsFromAPI(ip)
    : LOCAL_DEVELOPMENT_GEOLOCATION_DATA;

  return {
    city: geolocationDetails?.city ?? "Unknown",
    country: geolocationDetails?.country ?? "Unknown",
  };
};

const identifyRequestingDevice = (headers: Headers) => {
  const userAgent = headers.get("user-agent") ?? "";

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const deviceTypesMapping: Record<string, string> = {
    iOS: "Mobile",
    Android: "Mobile",
    "Mac OS": "Desktop",
    Windows: "Desktop",
  };

  const osName = result.os.name ?? "Unknown";
  const deviceType = result.device.type ?? deviceTypesMapping[osName] ?? "Unknown";

  return {
    browser: result.browser.name ?? "Unknown",
    os: osName,
    device: deviceType,
    model: result.device.model ?? "Unknown",
  };
};

const getUserIP = (headers: Headers) => {
  const xForwardedFor = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");

  if (xForwardedFor) {
    return xForwardedFor.split(",")[0]?.trim();
  }

  return realIp?.trim();
};

export const retrieveDeviceAndGeolocationData = async (headers: Headers) => {
  const [deviceDetails, geolocationDetails] = await Promise.all([
    identifyRequestingDevice(headers),
    getGeolocationDetails(getUserIP(headers)!),
  ]);

  return {
    ...deviceDetails,
    ...geolocationDetails,
  };
};

function safeIncrement<T extends string>(record: Record<T, number>, key: T): void {
  record[key] = (record[key] || 0) + 1;
}

type AggregateVisitsParams = {
  visits: RouterOutputs["link"]["linkVisits"]["totalVisits"];
  uniqueVisits: RouterOutputs["link"]["linkVisits"]["uniqueVisits"];
};

export const aggregateVisits = (
  visits: AggregateVisitsParams["visits"],
  uniqueVisits: AggregateVisitsParams["uniqueVisits"],
) => {
  const clicksPerDate: Record<string, number> = {};
  const uniqueClicksPerDate: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};

  // biome-ignore lint/complexity/noForEach: <explanation>
  visits.forEach((visit) => {
    const date = new Date(visit.createdAt!).toISOString().split("T")[0];
    safeIncrement(clicksPerDate, date!);

    if (visit.country) safeIncrement(clicksPerCountry, visit.country);
    if (visit.city) safeIncrement(clicksPerCity, visit.city);
    if (visit.device) safeIncrement(clicksPerDevice, visit.device);
    if (visit.os) safeIncrement(clicksPerOS, visit.os);
    if (visit.browser) safeIncrement(clicksPerBrowser, visit.browser);
    if (visit.model) safeIncrement(clicksPerModel, visit.model);
  });

  if (!uniqueVisits)
    return {
      clicksPerDate,
      clicksPerCountry,
      clicksPerCity,
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
    clicksPerDate,
    uniqueClicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  };
};
