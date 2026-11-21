import { Clipboard, getPreferenceValues, showHUD, showToast, Toast } from "@raycast/api";

import { createLink } from "./lib/api";
import { showApiFailure } from "./lib/feedback";
import { parseHttpUrl } from "./lib/url";

export default async function Command() {
  const { apiKey, defaultDomain } = getPreferenceValues<Preferences>();

  const url = parseHttpUrl(await Clipboard.readText());
  if (!url) {
    await showHUD("No URL in clipboard. Copy a link that starts with http:// or https://");
    return;
  }

  const toast = await showToast({ style: Toast.Style.Animated, title: "Shortening link…" });
  try {
    const link = await createLink(apiKey, { url, domain: defaultDomain });
    await Clipboard.copy(link.shortLink);
    await showHUD(`Copied ${link.shortLink}`);
  } catch (error) {
    await showApiFailure(error, toast);
  }
}
