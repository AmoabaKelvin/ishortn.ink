import { HonoRequest } from "hono";
import UAParser from "ua-parser-js";

import { env } from "@/env.mjs";

const DEFAULT_GEOLOCATION_DETAILS_FOR_LOCALHOST = {
  city: "localhost",
  country: "localhost",
};

const GEOLOCATION_API_URL = `https://api.findip.net/ipHere/?token=${env.GEOLOCATION_API_KEY}`;

const getGeolocationDetailsFromAPI = async (ip: string) => {
  const response = await fetch(GEOLOCATION_API_URL.replace("ipHere", ip));
  const data: GeolocationAPIResponseType = await response.json();

  return {
    city: data.city.names.en,
    country: data.country.names.en,
  };
};

const getGeolocationDetails = async (ip: string) => {
  const geolocationDetails = process.env.VERCEL
    ? await getGeolocationDetailsFromAPI(ip)
    : DEFAULT_GEOLOCATION_DETAILS_FOR_LOCALHOST;

  console.log("geolocationDetails", geolocationDetails);

  return {
    city: geolocationDetails?.city ?? "Unknown",
    country: geolocationDetails?.country ?? "Unknown",
  };
};

const getRequestingDeviceDetails = (req: HonoRequest) => {
  const userAgent = req.raw.headers.get("user-agent");
  const parser = new UAParser(userAgent!);

  const result = parser.getResult();

  const deviceTypesMapping = {
    ios: "Mobile",
    Android: "Mobile",
    "Mac OS": "Desktop",
    Windows: "Desktop",
  };

  return {
    browser: result.browser.name ?? "Unknown",
    os: result.os.name ?? "Unknown",
    device:
      (result.device.type ??
        deviceTypesMapping[
          result.os.name as keyof typeof deviceTypesMapping
        ]) ||
      "Unknown",
    model: result.device.model ?? "Unknown",
  };
};

const getUserIP = (req: HonoRequest) => {
  let forwardedFor = req.raw.headers.get("x-forwarded-for");
  let realIp = req.raw.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return null;
};

export const getDeviceAndGeolocationDetails = async (req: HonoRequest) => {
  const [deviceDetails, geolocationDetails] = await Promise.all([
    getRequestingDeviceDetails(req),
    getGeolocationDetails(getUserIP(req)!),
  ]);

  return {
    ...deviceDetails,
    ...geolocationDetails,
  };
};

type GeolocationAPIResponseType = {
  city: {
    geoname_id: number;
    names: {
      en: string;
    };
  };
  continent: {
    code: string;
    geoname_id: number;
    names: {
      de: string;
      en: string;
      es: string;
      fa: string;
      fr: string;
      ja: string;
      ko: string;
      "pt-BR": string;
      ru: string;
      "zh-CN": string;
    };
  };
  country: {
    geoname_id: number;
    is_in_european_union: boolean;
    iso_code: string;
    names: {
      de: string;
      en: string;
      es: string;
      fa: string;
      fr: string;
      ja: string;
      ko: string;
      "pt-BR": string;
      ru: string;
      "zh-CN": string;
    };
  };
  location: {
    latitude: number;
    longitude: number;
    time_zone: string;
    weather_code: string;
  };
  subdivisions: Array<{
    geoname_id: number;
    iso_code?: string;
    names: {
      en: string;
      ko?: string;
    };
  }>;
  traits: {
    autonomous_system_number: number;
    autonomous_system_organization: string;
    connection_type: string;
    isp: string;
    organization: string;
    user_type: string;
  };
};
