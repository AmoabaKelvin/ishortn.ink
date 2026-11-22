import { describe, expect, test } from "bun:test";

import { displayName, firstName, fullName, storedName } from "./user-name";

describe("fullName", () => {
  test("joins the parts that are set", () => {
    expect(fullName("Ama", "Mensah")).toBe("Ama Mensah");
    expect(fullName("Ama", null)).toBe("Ama");
    expect(fullName(null, "Mensah")).toBe("Mensah");
  });

  test("returns null when no part is set", () => {
    expect(fullName(null, null)).toBeNull();
    expect(fullName(undefined, "")).toBeNull();
  });
});

describe("storedName", () => {
  test("joins the parts that are set", () => {
    expect(storedName("Ama", "Mensah")).toBe("Ama Mensah");
    expect(storedName("Ama", null)).toBe("Ama");
  });

  test("returns an empty string, never null, when no part is set", () => {
    expect(storedName(null, null)).toBe("");
    expect(storedName(undefined, "")).toBe("");
  });

  test("reads back as no name", () => {
    expect(displayName(storedName(null, null))).toBeNull();
  });
});

describe("displayName", () => {
  test("treats literal null parts as missing", () => {
    expect(displayName("null null")).toBeNull();
    expect(displayName("null")).toBeNull();
    expect(displayName("undefined undefined")).toBeNull();
    expect(displayName("Ama null")).toBe("Ama");
    expect(displayName("null Mensah")).toBe("Mensah");
  });

  test("returns null for empty input", () => {
    expect(displayName("")).toBeNull();
    expect(displayName("   ")).toBeNull();
    expect(displayName(null)).toBeNull();
    expect(displayName(undefined)).toBeNull();
  });

  test("keeps real names", () => {
    expect(displayName("Ama Mensah")).toBe("Ama Mensah");
    expect(displayName("Ama Serwaa Mensah")).toBe("Ama Serwaa Mensah");
    expect(displayName("Nullah")).toBe("Nullah");
  });
});

describe("firstName", () => {
  test("returns the first real word", () => {
    expect(firstName("Ama Mensah")).toBe("Ama");
    expect(firstName("Ama null")).toBe("Ama");
    expect(firstName("null Mensah")).toBe("Mensah");
  });

  test("returns null when there is no real name", () => {
    expect(firstName("null null")).toBeNull();
    expect(firstName("null")).toBeNull();
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
