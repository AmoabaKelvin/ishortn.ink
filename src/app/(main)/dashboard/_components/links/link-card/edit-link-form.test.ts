import { describe, expect, test } from "bun:test";

import { createFormControl } from "react-hook-form";

import {
  geoRulesToFormValues,
  geoRulesToSubmit,
  mergeMilestones,
  syncEditLinkForm,
} from "./edit-link-form";

import type { SavedGeoRules } from "./edit-link-form";
import type { UpdateLinkInput } from "@/server/api/routers/link/link.input";

const savedRules: SavedGeoRules = [
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

const savedRuleValues = [
  {
    type: "country",
    condition: "in",
    values: ["GH", "NG"],
    action: "redirect",
    destination: "https://example.com/africa",
    blockMessage: undefined,
  },
];

const addedRule = {
  type: "device",
  condition: "in",
  values: ["ios"],
  action: "block",
  blockMessage: "Not on iOS",
} satisfies NonNullable<UpdateLinkInput["geoRules"]>[number];

type TestLink = { id: number; url: string };
const savedLink: TestLink = { id: 7, url: "https://example.com/old" };

const getDefaults = (link: TestLink, rules: SavedGeoRules | undefined): UpdateLinkInput => ({
  id: link.id,
  url: link.url,
  geoRules: geoRulesToFormValues(rules),
});

// Drives the form through the same sequence of inputs the dialog's effect sees.
const editDialog = () => {
  const form = createFormControl<UpdateLinkInput>({ defaultValues: getDefaults(savedLink, []) });
  const urlInput = form.register("url");
  let state: Parameters<typeof syncEditLinkForm<TestLink>>[2] = {
    open: false,
    link: savedLink,
    geoRules: undefined,
  };
  const update = (next: Partial<typeof state>) => {
    const prev = state;
    state = { ...state, ...next };
    syncEditLinkForm(form, prev, state, getDefaults);
  };
  const typeUrl = (value: string) =>
    urlInput.onChange({ target: { name: "url", value }, type: "change" });
  return { form, update, typeUrl };
};

describe("syncEditLinkForm", () => {
  test("keeps a URL typed while the geo rules were loading and fills in the rules", async () => {
    const { form, update, typeUrl } = editDialog();
    update({ open: true });
    await typeUrl("https://example.com/new");

    update({ geoRules: savedRules });

    expect(form.getValues("url")).toBe("https://example.com/new");
    expect(form.getValues("geoRules")).toEqual(savedRuleValues);
  });

  test("keeps rules added while loading, after the saved ones", () => {
    const { form, update } = editDialog();
    update({ open: true });
    form.setValue("geoRules", [addedRule]);

    update({ geoRules: savedRules });

    expect(form.getValues("geoRules")).toEqual([...savedRuleValues, addedRule]);
  });

  test("a refetch doesn't overwrite edits to the loaded rules", () => {
    const { form, update } = editDialog();
    update({ open: true });
    update({ geoRules: savedRules });
    form.setValue("geoRules", []);

    update({ geoRules: [...savedRules] });

    expect(form.getValues("geoRules")).toEqual([]);
  });

  test("a refetch updates rules the user hasn't touched", () => {
    const { form, update } = editDialog();
    update({ open: true });
    update({ geoRules: savedRules });

    update({ geoRules: [] });

    expect(form.getValues("geoRules")).toEqual([]);
  });

  test("reopening starts from the saved link, not abandoned edits", async () => {
    const { form, update, typeUrl } = editDialog();
    update({ open: true });
    update({ geoRules: savedRules });
    await typeUrl("https://example.com/new");
    form.setValue("geoRules", []);

    update({ open: false });
    update({ open: true });

    expect(form.getValues("url")).toBe(savedLink.url);
    expect(form.getValues("geoRules")).toEqual(savedRuleValues);
  });

  test("a different link resets the form", async () => {
    const { form, update, typeUrl } = editDialog();
    update({ open: true, geoRules: savedRules });
    await typeUrl("https://example.com/new");

    update({ link: { id: 7, url: "https://example.com/renamed" } });

    expect(form.getValues("url")).toBe("https://example.com/renamed");
  });
});

describe("geoRulesToSubmit", () => {
  const loadSaved = async () => savedRules;

  test("leaves the stored rules alone when saving before they loaded", async () => {
    expect(await geoRulesToSubmit([], undefined, loadSaved)).toBeUndefined();
    expect(await geoRulesToSubmit(undefined, undefined, loadSaved)).toBeUndefined();
  });

  test("keeps the stored rules ahead of rules added before they loaded", async () => {
    expect(await geoRulesToSubmit([addedRule], undefined, loadSaved)).toEqual([
      ...savedRuleValues,
      addedRule,
    ]);
  });

  test("submits the form's rules once loaded, including clearing them", async () => {
    expect(await geoRulesToSubmit([], savedRules, loadSaved)).toEqual([]);
    expect(await geoRulesToSubmit([addedRule], savedRules, loadSaved)).toEqual([addedRule]);
  });
});

describe("mergeMilestones", () => {
  test("adds new thresholds to the saved ones in order, keeping saved notification state", () => {
    const notifiedAt = new Date("2026-11-02T00:00:00Z");
    expect(
      mergeMilestones(
        [
          { threshold: 100, notifiedAt },
          { threshold: 1000, notifiedAt: null },
        ],
        [
          { threshold: 500, notifiedAt: null },
          { threshold: 100, notifiedAt: null },
        ],
      ),
    ).toEqual([
      { threshold: 100, notifiedAt },
      { threshold: 500, notifiedAt: null },
      { threshold: 1000, notifiedAt: null },
    ]);
  });
});
