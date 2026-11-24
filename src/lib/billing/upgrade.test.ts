import { describe, expect, test } from "bun:test";

import { ACTIVE_PROMO } from "./promo";
import {
  buildUpgradeUrl,
  checkoutReturnSearch,
  getUpgradeReason,
  nextPlanFor,
  resolveAutoUpgradePlan,
  resolveHighlightPlan,
} from "./upgrade";

describe("buildUpgradeUrl", () => {
  test("points at the pricing page with the plan and source", () => {
    expect(buildUpgradeUrl("pro", "custom_domain")).toBe(
      "/dashboard/pricing?highlight=pro&source=custom_domain",
    );
    expect(buildUpgradeUrl("ultra", "teams")).toBe(
      "/dashboard/pricing?highlight=ultra&source=teams",
    );
  });

  test("adds campaign UTMs only when the prompt showed a promo", () => {
    expect(buildUpgradeUrl("pro", "sidebar_free", null)).toBe(
      "/dashboard/pricing?highlight=pro&source=sidebar_free",
    );
    expect(buildUpgradeUrl("pro", "sidebar_free", ACTIVE_PROMO)).toBe(
      "/dashboard/pricing?highlight=pro&source=sidebar_free&utm_source=app&utm_medium=upgrade_prompt&utm_campaign=bfcm2026&utm_content=sidebar_free",
    );
  });
});

describe("nextPlanFor", () => {
  test("free limits lift on Pro, Pro limits on Ultra", () => {
    expect(nextPlanFor("free")).toBe("pro");
    expect(nextPlanFor("pro")).toBe("ultra");
  });
});

describe("getUpgradeReason", () => {
  test("names the highlighted plan for known sources", () => {
    expect(getUpgradeReason("custom_domain", "pro")).toBe("Custom domains are on Pro");
    expect(getUpgradeReason("folder_create", "ultra")).toBe("More folders are on Ultra");
  });

  test("shows nothing for unknown or missing sources", () => {
    expect(getUpgradeReason("<script>", "pro")).toBeNull();
    expect(getUpgradeReason("toString", "pro")).toBeNull();
    expect(getUpgradeReason(null, "pro")).toBeNull();
  });
});

describe("resolveHighlightPlan", () => {
  test("highlights paid plans above the current one", () => {
    expect(resolveHighlightPlan("pro", "free")).toBe("pro");
    expect(resolveHighlightPlan("ultra", "free")).toBe("ultra");
    expect(resolveHighlightPlan("ultra", "pro")).toBe("ultra");
  });

  test("ignores the current plan, lower plans and junk", () => {
    expect(resolveHighlightPlan("pro", "pro")).toBeNull();
    expect(resolveHighlightPlan("pro", "ultra")).toBeNull();
    expect(resolveHighlightPlan("free", "free")).toBeNull();
    expect(resolveHighlightPlan("enterprise", "free")).toBeNull();
    expect(resolveHighlightPlan(null, "free")).toBeNull();
  });
});

describe("resolveAutoUpgradePlan", () => {
  test("never starts checkout from an in-app highlight link", () => {
    const params = new URLSearchParams(buildUpgradeUrl("pro", "custom_domain").split("?")[1]);
    expect(resolveAutoUpgradePlan(params, "free", "checkout")).toBeNull();
  });

  test("keeps the ?plan= auto-upgrade used after signup", () => {
    expect(resolveAutoUpgradePlan(new URLSearchParams("plan=pro"), "free", "checkout")).toBe("pro");
    expect(resolveAutoUpgradePlan(new URLSearchParams("plan=ultra"), "pro", "update")).toBe(
      "ultra",
    );
  });

  test("skips plans at or below the current one and resumable subscriptions", () => {
    expect(resolveAutoUpgradePlan(new URLSearchParams("plan=pro"), "pro", "update")).toBeNull();
    expect(resolveAutoUpgradePlan(new URLSearchParams("plan=ultra"), "pro", "resume")).toBeNull();
    expect(resolveAutoUpgradePlan(new URLSearchParams("plan=free"), "free", "checkout")).toBeNull();
    expect(resolveAutoUpgradePlan(null, "free", "checkout")).toBeNull();
  });
});

describe("checkoutReturnSearch", () => {
  test("the sign-up entry no longer starts a checkout and keeps the plan preselected", () => {
    const search = checkoutReturnSearch("?plan=pro&interval=monthly", "pro");
    expect(search).toBe("?highlight=pro");
    const params = new URLSearchParams(search);
    expect(resolveAutoUpgradePlan(params, "free", "checkout")).toBeNull();
    expect(resolveHighlightPlan(params.get("highlight"), "free")).toBe("pro");
  });

  test("keeps the upgrade source and other params", () => {
    expect(checkoutReturnSearch("?highlight=pro&source=folders&utm_source=app", "ultra")).toBe(
      "?highlight=ultra&source=folders&utm_source=app",
    );
  });
});
