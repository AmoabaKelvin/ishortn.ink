import { open, openExtensionPreferences, showToast, Toast } from "@raycast/api";

import { toApiFailure } from "./errors";
import { PRICING_URL } from "./links";

/**
 * Shows an API or network failure as a toast (reusing a running one when given),
 * with the action that fixes it when there is one.
 */
export async function showApiFailure(error: unknown, toast?: Toast) {
  const failure = toApiFailure(error);
  const target = toast ?? (await showToast({ style: Toast.Style.Failure, title: failure.title }));
  target.style = Toast.Style.Failure;
  target.title = failure.title;
  target.message = failure.message;

  if (failure.kind === "invalid-key") {
    target.primaryAction = { title: "Open Extension Preferences", onAction: () => void openExtensionPreferences() };
  } else if (failure.kind === "plan-required") {
    target.primaryAction = { title: "View Plans", onAction: () => void open(PRICING_URL) };
  }
}
