import type { UpdateLinkInput } from "@/server/api/routers/link/link.input";
import type { RouterOutputs } from "@/trpc/shared";
import type { UseFormReturn } from "react-hook-form";

type SavedGeoRules = RouterOutputs["geoRules"]["getByLinkId"];

export const geoRulesToFormValues = (
  rules: SavedGeoRules | undefined,
): NonNullable<UpdateLinkInput["geoRules"]> =>
  rules?.map((rule) => ({
    type: rule.type,
    condition: rule.condition,
    values: rule.values,
    action: rule.action,
    destination: rule.destination ?? undefined,
    blockMessage: rule.blockMessage ?? undefined,
  })) ?? [];

// The geo rules query resolves after the dialog opens. Only that field is replaced, so a URL
// typed or pasted while it loaded is not reset back to the saved one. `setValue` rather than
// `resetField`: no input registers `geoRules`, and `resetField` ignores unregistered fields.
export const applyLoadedGeoRules = (
  form: Pick<UseFormReturn<UpdateLinkInput>, "setValue">,
  rules: SavedGeoRules | undefined,
) => form.setValue("geoRules", geoRulesToFormValues(rules));
