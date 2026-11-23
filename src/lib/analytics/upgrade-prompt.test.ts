import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { toast } from "sonner";

import * as events from "./events";
import { notifyPlanLimit } from "./upgrade-prompt";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("notifyPlanLimit", () => {
  test("the toast's Upgrade action opens pricing with the required plan preselected", () => {
    notifyPlanLimit("Folders are available on Pro and Ultra plans.", "folder_create", "pro");

    const shown = toast.getHistory().at(-1);
    expect(shown && "title" in shown ? shown.title : null).toBe(
      "Folders are available on Pro and Ultra plans.",
    );
    const action = shown && "action" in shown ? shown.action : undefined;
    expect(action && "label" in action ? action.label : null).toBe("Upgrade");

    const location = { href: "" };
    // The action assigns window.location.href (and analytics checks window exists).
    Object.defineProperty(globalThis, "window", { value: { location }, configurable: true });
    if (action && "onClick" in action) {
      // SAFETY: the handler ignores its event argument.
      action.onClick({} as never);
    }
    expect(location.href).toBe("/dashboard/pricing?highlight=pro&source=folder_create");
  });

  test("records the limit and the prompt impression under the same source", () => {
    const spy = spyOn(events, "trackEvent").mockImplementation(() => {});
    notifyPlanLimit("You've reached your monthly link limit.", "link_create", "pro");
    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls).toEqual([
      [events.POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source: "link_create" }],
      [events.POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN, { source: "link_create" }],
    ]);
  });
});
