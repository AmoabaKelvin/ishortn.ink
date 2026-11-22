import { useEffect, useRef } from "react";

import type { MilestoneEntry } from "@/app/(main)/dashboard/_components/milestone-form";
import type { UpdateLinkInput } from "@/server/api/routers/link/link.input";
import type { RouterOutputs } from "@/trpc/shared";
import type { UseFormReturn } from "react-hook-form";

export type SavedGeoRules = RouterOutputs["geoRules"]["getByLinkId"];
type GeoRuleValues = NonNullable<UpdateLinkInput["geoRules"]>;

export const geoRulesToFormValues = (rules: SavedGeoRules | undefined): GeoRuleValues =>
  rules?.map((rule) => ({
    type: rule.type,
    condition: rule.condition,
    values: rule.values,
    action: rule.action,
    destination: rule.destination ?? undefined,
    blockMessage: rule.blockMessage ?? undefined,
  })) ?? [];

// Before the saved rules load, the form holds only rules added since the dialog opened.
const withSavedGeoRules = (saved: SavedGeoRules, added: GeoRuleValues): GeoRuleValues => [
  ...geoRulesToFormValues(saved),
  ...added,
];

// Form values are plain JSON, and react-hook-form clones them on write, so compare by content.
const sameRules = (a: GeoRuleValues, b: GeoRuleValues) => JSON.stringify(a) === JSON.stringify(b);

type EditLinkFormSyncState<TLink> = {
  open: boolean;
  link: TLink;
  geoRules: SavedGeoRules | undefined;
};

type EditLinkForm = Pick<UseFormReturn<UpdateLinkInput>, "reset" | "setValue" | "getValues">;

// Opening the dialog, or a different link, resets the whole form to the saved link. The geo rules
// query resolves after the dialog opens, so its result only touches `geoRules`: a URL typed while
// it loaded stays, and so do rules the user already added or edited.
export const syncEditLinkForm = <TLink>(
  form: EditLinkForm,
  prev: EditLinkFormSyncState<TLink> | undefined,
  next: EditLinkFormSyncState<TLink>,
  getDefaults: (link: TLink, geoRules: SavedGeoRules | undefined) => UpdateLinkInput,
) => {
  if (!next.open) return;
  if (!prev?.open || prev.link !== next.link) {
    form.reset(getDefaults(next.link, next.geoRules));
    return;
  }
  if (prev.geoRules === next.geoRules || next.geoRules === undefined) return;

  // `setValue` rather than `resetField`: no input registers `geoRules`, and `resetField`
  // ignores unregistered fields.
  const current = form.getValues("geoRules") ?? [];
  if (sameRules(current, geoRulesToFormValues(prev.geoRules))) {
    form.setValue("geoRules", geoRulesToFormValues(next.geoRules));
  } else if (prev.geoRules === undefined) {
    form.setValue("geoRules", withSavedGeoRules(next.geoRules, current));
  }
};

export const useEditLinkFormSync = <TLink>(
  form: EditLinkForm,
  state: EditLinkFormSyncState<TLink>,
  getDefaults: (link: TLink, geoRules: SavedGeoRules | undefined) => UpdateLinkInput,
) => {
  const prev = useRef<EditLinkFormSyncState<TLink>>(undefined);
  useEffect(() => {
    syncEditLinkForm(form, prev.current, state, getDefaults);
    prev.current = state;
  }, [state.open, state.link, state.geoRules]);
};

// `updateLink` replaces the stored rules with whatever list it receives, so a save made before the
// saved rules loaded must not send the form's partial list on its own.
export const geoRulesToSubmit = async (
  formRules: GeoRuleValues | undefined,
  saved: SavedGeoRules | undefined,
  loadSaved: () => Promise<SavedGeoRules>,
): Promise<GeoRuleValues | undefined> => {
  if (saved !== undefined) return formRules;
  if (!formRules?.length) return undefined;
  return withSavedGeoRules(await loadSaved(), formRules);
};

export const mergeMilestones = (
  saved: MilestoneEntry[],
  added: MilestoneEntry[],
): MilestoneEntry[] => {
  const savedThresholds = new Set(saved.map((m) => m.threshold));
  return [...saved, ...added.filter((m) => !savedThresholds.has(m.threshold))].sort(
    (a, b) => a.threshold - b.threshold,
  );
};
