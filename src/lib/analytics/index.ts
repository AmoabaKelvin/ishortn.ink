import { HonoRequest } from "hono";
import { NextRequest } from "next/server";
import UAParser from "ua-parser-js";

const DEFAULT_GEOLOCATION_FOR_LOCALHOST = {
  city: "localhost",
  country: "localhost",
};

const getGeolocationDetails = async (req: HonoRequest) => {
  const nextRequest = new NextRequest(req.raw);

  const geolocationDetails = process.env.VERCEL
    ? nextRequest.geo
    : DEFAULT_GEOLOCATION_FOR_LOCALHOST;

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
    getGeolocationDetails(req),
  ]);

  return {
    ...deviceDetails,
    ...geolocationDetails,
  };
};
