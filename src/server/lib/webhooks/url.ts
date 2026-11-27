import { checkHttpUrl, type Resolver } from "@/server/lib/ssrf";

/**
 * Why `url` can't receive webhooks, or null when it can: it must be https and resolve only to
 * public addresses, so an endpoint can't be aimed at the deployment's own network. Deliveries run
 * the address check again, since DNS can change after the endpoint is saved.
 */
export async function webhookUrlError(url: string, resolve?: Resolver): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter a valid URL, like https://example.com/webhooks";
  }
  if (parsed.protocol !== "https:") return "Webhook URLs must start with https://";
  if (parsed.username || parsed.password) {
    return "Remove the username and password from the URL";
  }

  switch (await checkHttpUrl(url, resolve)) {
    case "public":
      return null;
    case "private":
      return "Webhook URLs can't point to private, loopback or link-local addresses";
    case "unresolved":
      return "We couldn't find this hostname. Check the URL and try again.";
    case "invalid":
      return "Enter a valid URL, like https://example.com/webhooks";
  }
}
