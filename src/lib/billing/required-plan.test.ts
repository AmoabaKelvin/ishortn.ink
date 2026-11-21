import { describe, expect, test } from "bun:test";

import { isPlanLimitError, linkEditLimitSource, requiredPlanForLimit } from "./required-plan";

describe("requiredPlanForLimit", () => {
  test("Ultra-only messages need Ultra", () => {
    expect(
      requiredPlanForLimit("UTM parameters are only available on the Ultra plan.", "free"),
    ).toBe("ultra");
    expect(
      requiredPlanForLimit(
        "You've reached your monthly limit of 1,000 links. Upgrade to Ultra for unlimited links.",
        "pro",
      ),
    ).toBe("ultra");
  });

  test("messages naming Pro, or no plan, lift on the next plan up", () => {
    expect(
      requiredPlanForLimit("Targeting rules are only available on Pro and Ultra plans.", "free"),
    ).toBe("pro");
    expect(requiredPlanForLimit("You've reached your plan's limit of 5 QR codes.", "free")).toBe(
      "pro",
    );
    expect(requiredPlanForLimit("You've reached your plan's limit of 5 QR codes.", "pro")).toBe(
      "ultra",
    );
  });
});

describe("isPlanLimitError", () => {
  test("FORBIDDEN plan messages are plan limits", () => {
    expect(
      isPlanLimitError({
        message: "Theme customization is available on Pro and Ultra plans.",
        data: { code: "FORBIDDEN" },
      }),
    ).toBe(true);
    expect(
      isPlanLimitError({
        message: "You have reached your folder limit. Upgrade to Ultra for unlimited folders.",
        data: { code: "FORBIDDEN" },
      }),
    ).toBe(true);
  });

  test("other errors are not", () => {
    expect(
      isPlanLimitError({
        message: "Selected domain is not available for this workspace.",
        data: { code: "FORBIDDEN" },
      }),
    ).toBe(false);
    expect(isPlanLimitError({ message: "Upgrade failed", data: { code: "BAD_REQUEST" } })).toBe(
      false,
    );
    expect(isPlanLimitError({ message: "Network error" })).toBe(false);
  });
});

describe("linkEditLimitSource", () => {
  test("maps the gate named in the server message", () => {
    expect(
      linkEditLimitSource(
        "Targeting rules are only available on Pro and Ultra plans. Please upgrade to use this feature.",
      ),
    ).toBe("geo_rules");
    expect(
      linkEditLimitSource(
        "Link saved, but milestones were not updated. Click milestone notifications are available on the Pro plan and above.",
      ),
    ).toBe("milestones");
    expect(linkEditLimitSource("Link cloaking is only available on the Ultra plan.")).toBe(
      "link_edit",
    );
  });
});
