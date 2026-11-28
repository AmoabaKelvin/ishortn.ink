import { generateState, parseAuthRedirect } from "./lib/auth-fragment.ts";
import { ext } from "./lib/browser.ts";
import { BASE_URL, urls } from "./lib/config.ts";
import { browserLabel } from "./lib/label.ts";
import { meCache } from "./lib/me-cache.ts";
import { local, session } from "./lib/storage.ts";

// The connect flow runs here rather than in the popup: the popup closes as soon as the
// sign-in window takes focus, which would drop the launchWebAuthFlow promise and the token.

let inFlight: Promise<void> | null = null;

const authFailureMessage = (error: unknown): string | null => {
  const message = error instanceof Error ? error.message : String(error);
  // Chromium reports an unreachable page this way; closing the window is a plain cancel.
  if (/could not be loaded/i.test(message)) {
    return "Couldn't open the iShortn sign-in page. Check your connection and try again.";
  }
  return null;
};

const connect = async (): Promise<void> => {
  const state = generateState();
  const platform = await ext.runtime.getPlatformInfo().catch(() => undefined);
  const label = browserLabel(navigator.userAgent, platform?.os);
  const url = urls.connect(BASE_URL, ext.identity.getRedirectURL(), state, label);

  await session.set("connectStatus", { status: "pending", at: Date.now() });

  let redirectUrl: string | undefined;
  try {
    redirectUrl = await ext.identity.launchWebAuthFlow({ url, interactive: true });
  } catch (error) {
    const message = authFailureMessage(error);
    if (message) {
      await session.set("connectStatus", { status: "error", message, at: Date.now() });
      return;
    }
    redirectUrl = undefined;
  }

  const result = parseAuthRedirect(redirectUrl, state);
  if (!result.ok) {
    await session.set("connectStatus", { status: "error", message: result.message, at: Date.now() });
    return;
  }

  await meCache.clear();
  await local.set("token", result.token);
  await session.remove("connectStatus");
  await session.remove("linkCache");
  try {
    // Reopen the popup so the user lands on their short link; not every browser allows it.
    await ext.action.openPopup();
  } catch {
    // the user can click the toolbar button
  }
};

ext.runtime.onMessage.addListener((message: unknown) => {
  if (message && typeof message === "object" && (message as { type?: unknown }).type === "connect") {
    inFlight ??= connect().finally(() => {
      inFlight = null;
    });
  }
  return false;
});
