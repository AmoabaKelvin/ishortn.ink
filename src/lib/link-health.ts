/** Why a destination check got no usable HTTP response (stored in LinkHealth.lastError). */
export type LinkHealthError =
  | "dns_failure"
  | "timeout"
  | "tls_error"
  | "connection_failed"
  | "too_many_redirects";

const ERROR_LABELS = new Map(
  Object.entries({
    dns_failure: "DNS lookup failed",
    timeout: "Timed out",
    tls_error: "TLS/SSL error",
    connection_failed: "Connection failed",
    too_many_redirects: "Too many redirects",
  } satisfies Record<LinkHealthError, string>),
);

const STATUS_LABELS = new Map([
  [404, "Not Found"],
  [410, "Gone"],
  [500, "Server error"],
  [502, "Bad gateway"],
  [503, "Service unavailable"],
  [504, "Gateway timeout"],
]);

/** "404 Not Found", "DNS lookup failed": what the last failed check saw, for badges and emails. */
export function describeLinkHealth(status: number | null, error: string | null): string {
  const errorLabel = error ? ERROR_LABELS.get(error) : undefined;
  if (errorLabel) return errorLabel;
  if (status === null) return "Unreachable";
  const label = STATUS_LABELS.get(status) ?? (status >= 500 ? "Server error" : null);
  return label ? `${status} ${label}` : `HTTP ${status}`;
}
