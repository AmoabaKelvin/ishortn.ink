import UAParser from "ua-parser-js";

import { env } from "@/env";
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

export const aggregateVisits = (linkVisits: RouterOutputs["link"]["linkVisits"]) => {
  const clicksPerDate: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};

  linkVisits.forEach((visit: RouterOutputs["link"]["linkVisits"][number]) => {
    const date = new Date(visit.createdAt!).toLocaleDateString();

    if (!clicksPerDate[date]) {
      clicksPerDate[date] = 0;
    }

    clicksPerDate[date] += 1;

    if (!clicksPerCountry[visit.country!]) {
      clicksPerCountry[visit.country!] = 0;
    }

    clicksPerCountry[visit.country!] += 1;

    if (!clicksPerCity[visit.city!]) {
      clicksPerCity[visit.city!] = 0;
    }

    clicksPerCity[visit.city!] += 1;

    if (!clicksPerDevice[visit.device!]) {
      clicksPerDevice[visit.device!] = 0;
    }

    clicksPerDevice[visit.device!] += 1;

    if (!clicksPerOS[visit.os!]) {
      clicksPerOS[visit.os!] = 0;
    }

    clicksPerOS[visit.os!] += 1;

    if (!clicksPerBrowser[visit.browser!]) {
      clicksPerBrowser[visit.browser!] = 0;
    }

    clicksPerBrowser[visit.browser!] += 1;

    if (!clicksPerModel[visit.model!]) {
      clicksPerModel[visit.model!] = 0;
    }

    clicksPerModel[visit.model!] += 1;

    return {
      clicksPerDate,
      clicksPerCountry,
      clicksPerCity,
      clicksPerDevice,
      clicksPerOS,
      clicksPerBrowser,
      clicksPerModel,
    };
  });

  return {
    clicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  } as const;
};
