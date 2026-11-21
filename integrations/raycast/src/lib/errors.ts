export type ApiFailure =
  | { kind: "invalid-key"; title: string; message: string }
  | { kind: "plan-required"; title: string; message: string }
  | { kind: "rate-limited"; title: string; message: string; retryAfterSeconds: number }
  | { kind: "request"; title: string; message: string; status: number }
  | { kind: "network"; title: string; message: string };

export class IshortnApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = "IshortnApiError";
    this.failure = failure;
  }
}

// v1 errors are `{ error: { code, message, details } }`, except the plan gate,
// whose body is `{ error: "API access requires Pro", upgrade_url }`.
function errorFields(body: unknown): { message?: string; planGate: boolean } {
  if (!body || typeof body !== "object" || !("error" in body)) return { planGate: false };
  const { error } = body;
  if (typeof error === "string") return { message: error, planGate: true };
  if (!error || typeof error !== "object" || !("message" in error)) return { planGate: false };
  return { message: typeof error.message === "string" ? error.message : undefined, planGate: false };
}

/** Seconds until the API accepts requests again: Retry-After, else the X-RateLimit-Reset time. */
export function retryAfterSeconds(headers: Headers, nowMs: number): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return Math.max(1, Math.ceil(reset - nowMs / 1000));
  return 60;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export function failureFromResponse(status: number, body: unknown, headers: Headers, nowMs: number): ApiFailure {
  const { message, planGate } = errorFields(body);

  if (status === 401) {
    return {
      kind: "invalid-key",
      title: "Invalid API key",
      message: "Check the API key in the extension preferences.",
    };
  }
  if (status === 403 && planGate) {
    return {
      kind: "plan-required",
      title: "API access needs a Pro or Ultra plan",
      message: "Upgrade your iShortn plan to use the extension.",
    };
  }
  if (status === 429) {
    const wait = retryAfterSeconds(headers, nowMs);
    return {
      kind: "rate-limited",
      title: "Rate limit reached",
      message: `Try again in ${formatWait(wait)}.`,
      retryAfterSeconds: wait,
    };
  }
  if (status >= 500) {
    return {
      kind: "request",
      status,
      title: "iShortn is unavailable",
      message: "Something went wrong. Try again later.",
    };
  }
  return { kind: "request", status, title: message ?? `Request failed (${status})`, message: "" };
}

export function failureFromNetworkError(error: unknown): ApiFailure {
  // Node's fetch rejects with "fetch failed" and keeps the reason in `cause`.
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
  const message = cause?.message ?? (error instanceof Error ? error.message : String(error));
  return { kind: "network", title: "Couldn't reach iShortn", message };
}

export function toApiFailure(error: unknown): ApiFailure {
  return error instanceof IshortnApiError ? error.failure : failureFromNetworkError(error);
}
