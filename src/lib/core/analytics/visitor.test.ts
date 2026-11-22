import { describe, expect, test } from "bun:test";

import { describeVisitor, parseDeviceDetails } from "./visitor";

// ua-parser-js takes the Android device model verbatim from the User-Agent.
const LONG_MODEL_UA = `Mozilla/5.0 (Linux; Android 10; ${"X".repeat(220)} Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36`;

describe("visitor field lengths", () => {
  // LinkVisit stores these in varchar(191); a longer value fails the whole click batch.
  test("caps a crafted User-Agent's device model at 191 characters", async () => {
    const details = await parseDeviceDetails(new Headers({ "user-agent": LONG_MODEL_UA }));
    expect(details.model).toBe("X".repeat(191));
    expect(details.device).toBe("mobile");
  });

  test("caps the city name at 191 characters", async () => {
    const visitor = await describeVisitor({
      headers: new Headers({ "user-agent": LONG_MODEL_UA }),
      ip: "203.0.113.7",
      country: "GH",
      city: "C".repeat(300),
    });
    expect(visitor?.city).toHaveLength(191);
    expect(visitor?.country).toBe("Ghana");
    expect(visitor?.model).toHaveLength(191);
  });
});
