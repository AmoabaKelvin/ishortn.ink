import { describe, expect, test } from "bun:test";

import { submitAcquisitionInput } from "./audience-feedback.input";
import {
  ACQUISITION_PROMPT_CHECKOUT_QUIET_MS,
  ACQUISITION_PROMPT_COOLDOWN_MS,
  acquisitionAnswerValues,
  acquisitionPromptState,
} from "./utils";

const NOW = new Date("2026-11-22T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyRow = {
  submittedAt: null,
  acquisitionAnsweredAt: null,
  acquisitionDismissedAt: null,
  acquisitionDismissCount: 0,
};

describe("submitAcquisitionInput", () => {
  test("requires a known acquisition channel", () => {
    expect(submitAcquisitionInput.safeParse({}).success).toBe(false);
    expect(submitAcquisitionInput.safeParse({ acquisitionChannel: "tv" }).success).toBe(false);
    expect(submitAcquisitionInput.safeParse({ acquisitionChannel: "search" }).success).toBe(true);
  });

  test("accepts an optional detail up to 2000 characters, trimmed", () => {
    const parsed = submitAcquisitionInput.parse({
      acquisitionChannel: "community",
      acquisitionDetail: "  r/smallbusiness thread  ",
    });
    expect(parsed.acquisitionDetail).toBe("r/smallbusiness thread");

    const tooLong = submitAcquisitionInput.safeParse({
      acquisitionChannel: "community",
      acquisitionDetail: "a".repeat(2001),
    });
    expect(tooLong.success).toBe(false);
  });

  test("accepts an optional known use case", () => {
    expect(
      submitAcquisitionInput.safeParse({ acquisitionChannel: "ad", useCase: "qr_codes" }).success,
    ).toBe(true);
    expect(
      submitAcquisitionInput.safeParse({ acquisitionChannel: "ad", useCase: null }).success,
    ).toBe(true);
    expect(
      submitAcquisitionInput.safeParse({ acquisitionChannel: "ad", useCase: "gaming" }).success,
    ).toBe(false);
  });
});

describe("acquisitionPromptState", () => {
  test("never prompts free accounts", () => {
    expect(acquisitionPromptState("free", null, NOW)).toEqual({
      plan: "free",
      showOnDashboard: false,
      showAfterCheckout: false,
    });
    expect(acquisitionPromptState("free", emptyRow, NOW).showOnDashboard).toBe(false);
  });

  test("prompts a paid account with no feedback row", () => {
    expect(acquisitionPromptState("pro", undefined, NOW)).toEqual({
      plan: "pro",
      showOnDashboard: true,
      showAfterCheckout: true,
    });
  });

  test("prompts a paid account whose row only holds full-survey dismissals", () => {
    expect(acquisitionPromptState("ultra", emptyRow, NOW).showOnDashboard).toBe(true);
  });

  test("stops once the acquisition question is answered", () => {
    const state = acquisitionPromptState("pro", { ...emptyRow, acquisitionAnsweredAt: NOW }, NOW);
    expect(state.showOnDashboard).toBe(false);
    expect(state.showAfterCheckout).toBe(false);
  });

  test("treats a submitted full survey as answered", () => {
    const state = acquisitionPromptState("pro", { ...emptyRow, submittedAt: NOW }, NOW);
    expect(state.showOnDashboard).toBe(false);
    expect(state.showAfterCheckout).toBe(false);
  });

  test("hides the dashboard card for 14 days after one dismissal", () => {
    const dismissed = (msAgo: number) => ({
      ...emptyRow,
      acquisitionDismissedAt: new Date(NOW.getTime() - msAgo),
      acquisitionDismissCount: 1,
    });

    expect(acquisitionPromptState("pro", dismissed(DAY_MS), NOW).showOnDashboard).toBe(false);
    expect(acquisitionPromptState("pro", dismissed(13 * DAY_MS), NOW).showOnDashboard).toBe(false);
    expect(
      acquisitionPromptState("pro", dismissed(ACQUISITION_PROMPT_COOLDOWN_MS), NOW).showOnDashboard,
    ).toBe(true);
    expect(acquisitionPromptState("pro", dismissed(30 * DAY_MS), NOW).showOnDashboard).toBe(true);
  });

  test("asks right after checkout even inside the cooldown", () => {
    const row = {
      ...emptyRow,
      acquisitionDismissedAt: new Date(NOW.getTime() - 2 * DAY_MS),
      acquisitionDismissCount: 1,
    };
    expect(acquisitionPromptState("pro", row, NOW).showAfterCheckout).toBe(true);
    expect(acquisitionPromptState("pro", row, NOW).showOnDashboard).toBe(false);
  });

  test("doesn't ask again after a plan change right after Not now", () => {
    // First checkout: never asked before, so the prompt opens.
    expect(acquisitionPromptState("pro", emptyRow, NOW).showAfterCheckout).toBe(true);

    // "Not now", then an upgrade to Ultra on the same screen a minute later.
    const dismissedAt = NOW;
    const afterUpgrade = new Date(NOW.getTime() + 60 * 1000);
    const row = { ...emptyRow, acquisitionDismissedAt: dismissedAt, acquisitionDismissCount: 1 };
    expect(acquisitionPromptState("ultra", row, afterUpgrade).showAfterCheckout).toBe(false);

    const nextDay = new Date(NOW.getTime() + ACQUISITION_PROMPT_CHECKOUT_QUIET_MS);
    expect(acquisitionPromptState("ultra", row, nextDay).showAfterCheckout).toBe(true);
  });

  test("doesn't ask again after a plan change once answered", () => {
    const row = { ...emptyRow, acquisitionAnsweredAt: NOW };
    const afterUpgrade = new Date(NOW.getTime() + 60 * 1000);
    expect(acquisitionPromptState("ultra", row, afterUpgrade).showAfterCheckout).toBe(false);
  });

  test("never shows again after the second dismissal", () => {
    const row = {
      ...emptyRow,
      acquisitionDismissedAt: new Date(NOW.getTime() - 60 * DAY_MS),
      acquisitionDismissCount: 2,
    };
    const state = acquisitionPromptState("ultra", row, NOW);
    expect(state.showOnDashboard).toBe(false);
    expect(state.showAfterCheckout).toBe(false);
  });
});

describe("acquisitionAnswerValues", () => {
  test("writes only the acquisition answer, the plan and its timestamp", () => {
    expect(
      acquisitionAnswerValues(
        {
          acquisitionChannel: "search",
          acquisitionDetail: "bitly alternative",
          useCase: "qr_codes",
        },
        "pro",
        NOW,
      ),
    ).toEqual({
      acquisitionChannel: "search",
      acquisitionDetail: "bitly alternative",
      useCase: "qr_codes",
      planSnapshot: "pro",
      acquisitionAnsweredAt: NOW,
    });
  });

  test("leaves an earlier use case alone when none is given and clears a blank detail", () => {
    const values = acquisitionAnswerValues(
      { acquisitionChannel: "friend_or_colleague", acquisitionDetail: "", useCase: null },
      "ultra",
      NOW,
    );
    expect(values).not.toHaveProperty("useCase");
    expect(values.acquisitionDetail).toBeNull();
  });
});
