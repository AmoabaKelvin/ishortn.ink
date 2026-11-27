import { describe, expect, test } from "bun:test";

import { workEmailDomain } from "./utils";

describe("workEmailDomain", () => {
  test("returns the domain of a company email, lowercased", () => {
    expect(workEmailDomain("Ama@Acme.co.uk")).toBe("acme.co.uk");
    expect(workEmailDomain("sales@mail.northwind.com")).toBe("mail.northwind.com");
  });

  test("skips shared mailbox providers and their regional variants", () => {
    expect(workEmailDomain("ama@gmail.com")).toBeNull();
    expect(workEmailDomain("ama@hotmail.co.uk")).toBeNull();
    expect(workEmailDomain("ama@yahoo.fr")).toBeNull();
    expect(workEmailDomain("x1y2@privaterelay.appleid.com")).toBeNull();
  });

  test("skips universities", () => {
    expect(workEmailDomain("ama@mit.edu")).toBeNull();
    expect(workEmailDomain("ama@ox.ac.uk")).toBeNull();
  });

  test("returns null for missing or malformed addresses", () => {
    expect(workEmailDomain(null)).toBeNull();
    expect(workEmailDomain("")).toBeNull();
    expect(workEmailDomain("acme.com")).toBeNull();
    expect(workEmailDomain("ama@localhost")).toBeNull();
  });
});
