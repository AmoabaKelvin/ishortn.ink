import { describe, expect, test } from "bun:test";

import { companyEmailDomain } from "./company-domain";

describe("companyEmailDomain", () => {
  test("returns the domain of a company address", () => {
    expect(companyEmailDomain("jane@acme.com")).toBe("acme.com");
    expect(companyEmailDomain("Jane@Acme-Tools.CO.UK")).toBe("acme-tools.co.uk");
    expect(companyEmailDomain("ops@studio.io")).toBe("studio.io");
  });

  test("drops mail subdomains so the offer is built on the company's own domain", () => {
    expect(companyEmailDomain("jane@eu.acme.com")).toBe("acme.com");
    expect(companyEmailDomain("jane@mail.acme-tools.co.uk")).toBe("acme-tools.co.uk");
    expect(companyEmailDomain("a@mail.yahoo.co.uk")).toBeNull();
  });

  test("treats the big free-mail providers and their regional domains as free mail", () => {
    for (const email of [
      "a@gmail.com",
      "a@googlemail.com",
      "a@outlook.com",
      "a@hotmail.com",
      "a@hotmail.fr",
      "a@live.com",
      "a@yahoo.com",
      "a@yahoo.co.uk",
      "a@ymail.com",
      "a@icloud.com",
      "a@me.com",
      "a@aol.com",
      "a@proton.me",
      "a@protonmail.com",
      "a@gmx.de",
      "a@yandex.ru",
      "a@qq.com",
      "a@web.de",
    ]) {
      expect(companyEmailDomain(email)).toBeNull();
    }
  });

  test("returns null without a usable address", () => {
    expect(companyEmailDomain(null)).toBeNull();
    expect(companyEmailDomain(undefined)).toBeNull();
    expect(companyEmailDomain("")).toBeNull();
    expect(companyEmailDomain("no-at-sign")).toBeNull();
    expect(companyEmailDomain("a@localhost")).toBeNull();
  });
});
