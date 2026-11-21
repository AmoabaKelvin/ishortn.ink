import { failureFromNetworkError, failureFromResponse, IshortnApiError } from "./errors";
import { API_BASE_URL } from "./links";

export type CreatedLink = {
  shortLink: string;
  url: string;
  alias: string;
};

type Counts = Record<string, number>;

export type LinkAnalytics = {
  totalClicks: number;
  clicksPerCountry: Counts;
  clicksPerDevice: Counts;
  clicksPerReferrer: Counts;
  window: { days: number | null; from: string | null; to: string };
};

async function request<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "x-api-key": apiKey.trim(), "content-type": "application/json", ...init.headers },
    });
  } catch (error) {
    throw new IshortnApiError(failureFromNetworkError(error));
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new IshortnApiError(failureFromResponse(response.status, body, response.headers, Date.now()));
  }
  return body as T;
}

export function createLink(apiKey: string, input: { url: string; alias?: string; domain?: string }) {
  return request<CreatedLink>(apiKey, "/links", {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      alias: input.alias?.trim() || undefined,
      domain: input.domain?.trim() || undefined,
    }),
  });
}

export function getLinkAnalytics(apiKey: string, alias: string, domain?: string) {
  const query = domain ? `?${new URLSearchParams({ domain })}` : "";
  return request<LinkAnalytics>(apiKey, `/analytics/${encodeURIComponent(alias)}${query}`);
}
