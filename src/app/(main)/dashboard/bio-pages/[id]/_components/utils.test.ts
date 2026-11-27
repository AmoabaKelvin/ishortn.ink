import { describe, expect, test } from "bun:test";

import {
  bioBlockLimitSource,
  formatMutationError,
  getBlockPreviewNote,
  getSlugError,
  isDraftDirty,
  toSettingsDraft,
} from "./utils";

const savedPage = {
  slug: "jane",
  title: null,
  description: "Designer",
  avatarUrl: null,
  theme: { preset: "minimal", font: "serif" },
  removeBranding: false,
  customDomain: null,
  socialImageUrl: null,
};

describe("isDraftDirty", () => {
  test("a fresh draft of the saved page is clean", () => {
    expect(isDraftDirty(toSettingsDraft(savedPage), toSettingsDraft(savedPage))).toBe(false);
  });

  test("an edited field is dirty, and editing it back is clean again", () => {
    const saved = toSettingsDraft(savedPage);
    const edited = { ...saved, title: "Jane" };
    expect(isDraftDirty(edited, saved)).toBe(true);
    expect(isDraftDirty({ ...edited, title: "" }, saved)).toBe(false);
  });

  test("theme key order does not matter", () => {
    const saved = toSettingsDraft(savedPage);
    const reordered = { ...saved, theme: { font: "serif", preset: "minimal" } };
    expect(isDraftDirty(reordered, saved)).toBe(false);
    expect(isDraftDirty({ ...saved, theme: { ...saved.theme, font: "mono" } }, saved)).toBe(true);
  });
});

describe("getSlugError", () => {
  test("rejects handles shorter than 3 characters", () => {
    expect(getSlugError("ab")).toBe("Handle must be at least 3 characters");
    expect(getSlugError("")).toBe("Handle must be at least 3 characters");
  });

  test("rejects disallowed characters", () => {
    expect(getSlugError("Jane Doe")).toBe(
      "Use lowercase letters, numbers, dashes, and underscores only",
    );
  });

  test("accepts a valid handle", () => {
    expect(getSlugError("jane_doe-1")).toBeNull();
  });
});

describe("formatMutationError", () => {
  test("prefers the first zod field message over the raw issue list", () => {
    expect(
      formatMutationError({
        message: '[{"code":"too_small","minimum":3,"path":["slug"]}]',
        data: {
          zodError: {
            formErrors: [],
            fieldErrors: { slug: ["Handle must be at least 3 characters"] },
          },
        },
      }),
    ).toBe("Handle must be at least 3 characters");
  });

  test("falls back to the server message for non-input errors", () => {
    expect(
      formatMutationError({ message: "That handle is taken.", data: { zodError: null } }),
    ).toBe("That handle is taken.");
  });
});

describe("getBlockPreviewNote", () => {
  const now = new Date("2026-11-20T12:00:00Z").getTime();
  const base = {
    type: "link" as const,
    isVisible: true,
    scheduledAt: null,
    scheduledUntil: null,
    blocked: false,
  };

  test("live blocks have no note", () => {
    expect(getBlockPreviewNote(base, now)).toBeNull();
  });

  test("flags hidden, blocked, scheduled and ended blocks", () => {
    expect(getBlockPreviewNote({ ...base, isVisible: false }, now)).toBe("Hidden");
    expect(getBlockPreviewNote({ ...base, blocked: true }, now)).toBe("Blocked, not shown");
    expect(
      getBlockPreviewNote({ ...base, scheduledAt: new Date("2026-11-21T00:00:00Z") }, now),
    ).toBe("Scheduled");
    expect(
      getBlockPreviewNote({ ...base, scheduledUntil: new Date("2026-11-20T11:00:00Z") }, now),
    ).toBe("Ended");
  });

  test("an image block behind a blocked link is flagged like a link block", () => {
    expect(getBlockPreviewNote({ ...base, type: "image", blocked: true }, now)).toBe(
      "Blocked, not shown",
    );
  });
});

describe("bioBlockLimitSource", () => {
  test("names the gate from the server's message", () => {
    expect(
      bioBlockLimitSource(
        "The free plan allows 1 embed block per bio page. Upgrade to Pro for unlimited embeds.",
      ),
    ).toBe("bio_embed_block_limit");
    expect(bioBlockLimitSource("Image blocks are available on Pro and Ultra plans.")).toBe(
      "bio_image_blocks",
    );
    expect(bioBlockLimitSource("Scheduled blocks are available on the Ultra plan.")).toBe(
      "bio_scheduled_blocks",
    );
    expect(
      bioBlockLimitSource(
        "The free plan allows 3 link blocks per bio page. Upgrade to Pro for unlimited link blocks.",
      ),
    ).toBe("bio_link_block_limit");
  });
});
