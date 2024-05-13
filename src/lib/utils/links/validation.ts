import { env } from "@/env.mjs";

const formRequestBody = (url: string) => {
  return {
    client: {
      clientId: "your-client-id",
      clientVersion: "1.0",
    },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  };
};

export const validateUrl = async (url: string) => {
  if (!env.VERCEL_URL) {
    return true;
  }

  const apiKey = env.GOOGLE_SAFE_BROWSING_API_KEY;

  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      ContentType: "application/json",
    },
    body: JSON.stringify(formRequestBody(url)),
  });

  const data = await response.json();

  // for a successful validation, there should not be anything in the response
  if (Object.keys(data).length === 0) {
    return true;
  }

  return false;
};
