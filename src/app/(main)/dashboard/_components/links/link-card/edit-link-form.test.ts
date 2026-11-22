import { describe, expect, test } from "bun:test";

import { createFormControl } from "react-hook-form";

import { applyLoadedGeoRules, geoRulesToFormValues } from "./edit-link-form";

import type { UpdateLinkInput } from "@/server/api/routers/link/link.input";
import type { RouterOutputs } from "@/trpc/shared";

const savedRules: RouterOutputs["geoRules"]["getByLinkId"] = [
  {
    id: 1,
    linkId: 7,
    type: "country",
    condition: "in",
    values: ["GH", "NG"],
    action: "redirect",
    destination: "https://example.com/africa",
    blockMessage: null,
    priority: 0,
    createdAt: new Date("2026-11-01T00:00:00Z"),
  },
];

const savedUrl = "https://example.com/old";

// The dialog as it opens before the geo rules query has resolved, with the URL input mounted.
const openWithRulesPending = () => {
  const form = createFormControl<UpdateLinkInput>({
    defaultValues: { id: 7, url: savedUrl, geoRules: geoRulesToFormValues(undefined) },
  });
  const urlInput = form.register("url");
  const type = (value: string) =>
    urlInput.onChange({ target: { name: "url", value }, type: "change" });
  return { form, type };
};

describe("applyLoadedGeoRules", () => {
  test("keeps a URL typed while the geo rules were loading and fills in the rules", async () => {
    const { form, type } = openWithRulesPending();
    await type("https://example.com/new");

    applyLoadedGeoRules(form, savedRules);

    expect(form.getValues("url")).toBe("https://example.com/new");
    expect(form.getValues("geoRules")).toEqual([
      {
        type: "country",
        condition: "in",
        values: ["GH", "NG"],
        action: "redirect",
        destination: "https://example.com/africa",
        blockMessage: undefined,
      },
    ]);
  });

  test("a full reset on reopen still starts from the saved link", async () => {
    const { form, type } = openWithRulesPending();
    await type("https://example.com/new");
    applyLoadedGeoRules(form, savedRules);

    form.reset({ id: 7, url: savedUrl, geoRules: geoRulesToFormValues(savedRules) });

    expect(form.getValues("url")).toBe(savedUrl);
    expect(form.getValues("geoRules")).toHaveLength(1);
  });
});
