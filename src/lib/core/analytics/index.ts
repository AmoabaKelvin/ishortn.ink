import UAParser from "ua-parser-js";

import { env } from "@/env";
import { LOCAL_DEVELOPMENT_GEOLOCATION_DATA } from "@/lib/constants";

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
