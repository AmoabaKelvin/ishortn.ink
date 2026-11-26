import { describe, expect, test } from "bun:test";

import { domainBeyondPlanMessage } from "@/server/api/routers/link/utils";
import { monthlyLinkLimitMessage } from "@/server/lib/user-plan";

import {
  isPlanLimitError,
  linkEditLimitSource,
  planLimitKey,
  requiredPlanForLimit,
} from "./required-plan";

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

describe("planLimitKey", () => {
  test("names the limit behind each link-create refusal", () => {
    expect(planLimitKey(monthlyLinkLimitMessage("free", 30))).toBe("monthly_links");
    expect(planLimitKey(monthlyLinkLimitMessage("pro", 1000))).toBe("monthly_links");
    expect(planLimitKey(domainBeyondPlanMessage("go.acme.com", 0))).toBe("custom_domain");
    expect(planLimitKey(domainBeyondPlanMessage("go.acme.com", 1))).toBe("custom_domain");
    expect(planLimitKey("Domain not available for this account")).toBe("custom_domain");
    expect(planLimitKey("You need to upgrade to a pro plan to use password protection")).toBe(
      "password",
    );
    expect(
      planLimitKey(
        "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
      ),
    ).toBe("utm");
    expect(planLimitKey("Scheduled links are only available on Pro and Ultra plans")).toBe(
      "scheduling",
    );
  });

  test("falls back to other for gates it doesn't know", () => {
    expect(planLimitKey("Theme customization is available on Pro and Ultra plans.")).toBe("other");
  });
});
