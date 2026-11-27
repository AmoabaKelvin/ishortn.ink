import { describe, expect, test } from "bun:test";

import {
  escapeVCardText,
  serializeVCard,
  telHref,
  vcardFileName,
  vcardPayloadSchema,
  vcardSummary,
} from "./vcard";

import type { VCardPayload } from "./vcard";

const EMPTY = {
  type: "vcard",
  firstName: "",
  lastName: "",
  organization: "",
  jobTitle: "",
  phone: "",
  phone2: "",
  email: "",
  website: "",
  address: "",
  note: "",
} satisfies VCardPayload;

const card = (fields: Partial<VCardPayload>): VCardPayload => ({ ...EMPTY, ...fields });

describe("escapeVCardText", () => {
  test("escapes backslashes, commas and semicolons and turns newlines into \\n", () => {
    expect(escapeVCardText("a\\b,c;d")).toBe("a\\\\b\\,c\\;d");
    expect(escapeVCardText("line 1\nline 2\r\nline 3\rline 4")).toBe(
      "line 1\\nline 2\\nline 3\\nline 4",
    );
  });

  test("escapes the backslash before adding escapes of its own", () => {
    expect(escapeVCardText("\\,")).toBe("\\\\\\,");
  });
});

describe("serializeVCard", () => {
  test("writes a vCard 3.0 with CRLF line endings and every set field", () => {
    const vcf = serializeVCard(
      card({
        firstName: "Ada",
        lastName: "Lovelace",
        organization: "Analytical Engines, Ltd.",
        jobTitle: "Engineer; Mathematician",
        phone: "+44 20 7946 0000",
        phone2: "+44 7700 900000",
        email: "ada@example.com",
        website: "https://example.com/ada",
        address: "12 St James's Square, London",
        note: "Met at the expo\nAsk about the engine",
      }),
    );
    expect(vcf).toBe(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "N:Lovelace;Ada;;;",
        "FN:Ada Lovelace",
        "ORG:Analytical Engines\\, Ltd.",
        "TITLE:Engineer\\; Mathematician",
        "TEL;TYPE=VOICE:+44 20 7946 0000",
        "TEL;TYPE=VOICE:+44 7700 900000",
        "EMAIL;TYPE=INTERNET:ada@example.com",
        "URL:https://example.com/ada",
        "ADR;TYPE=WORK:;;12 St James's Square\\, London;;;;",
        "NOTE:Met at the expo\\nAsk about the engine",
        "END:VCARD",
        "",
      ].join("\r\n"),
    );
    expect(vcf.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  test("leaves out empty optional fields", () => {
    expect(serializeVCard(card({ firstName: "Ada" }))).toBe(
      "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;Ada;;;\r\nFN:Ada\r\nEND:VCARD\r\n",
    );
  });

  test("lists a card with only an organisation under the company", () => {
    const vcf = serializeVCard(card({ organization: "Acme; Sons" }));
    expect(vcf).toContain("\r\nN:;;;;\r\n");
    expect(vcf).toContain("\r\nFN:Acme\\; Sons\r\n");
    expect(vcf).toContain("\r\nX-ABShowAs:COMPANY\r\n");
    expect(vcf).toContain("\r\nORG:Acme\\; Sons\r\n");
  });

  test("keeps UTF-8 names as they are", () => {
    expect(serializeVCard(card({ firstName: "José", lastName: "Ñúñez" }))).toContain(
      "\r\nN:Ñúñez;José;;;\r\nFN:José Ñúñez\r\n",
    );
    expect(serializeVCard(card({ firstName: "雷", lastName: "李" }))).toContain(
      "\r\nN:李;雷;;;\r\nFN:雷 李\r\n",
    );
  });

  test("folds lines over 75 octets without splitting a character", () => {
    const vcf = serializeVCard(card({ firstName: "Ada", note: "李".repeat(60) }));
    const noteLines = vcf.slice(vcf.indexOf("NOTE:")).split("\r\n");
    const encoder = new TextEncoder();
    const folded = noteLines.slice(0, noteLines.indexOf("END:VCARD"));
    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    for (const line of folded.slice(1)) expect(line.startsWith(" ")).toBe(true);
    // Unfolding (drop CRLF + one space) gives back the original line.
    expect(folded.join("\r\n").replace(/\r\n /g, "")).toBe(`NOTE:${"李".repeat(60)}`);
  });
});

describe("vcardPayloadSchema", () => {
  test("needs a first name or an organisation", () => {
    const result = vcardPayloadSchema.safeParse(card({ lastName: "Lovelace" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["firstName"]);
    expect(vcardPayloadSchema.safeParse(card({ organization: "Acme" })).success).toBe(true);
    expect(vcardPayloadSchema.safeParse(card({ firstName: "Ada" })).success).toBe(true);
  });

  test("adds https:// to a website and rejects other schemes", () => {
    expect(
      vcardPayloadSchema.parse(card({ firstName: "Ada", website: "example.com" })).website,
    ).toBe("https://example.com");
    for (const website of ["javascript:alert(1)", "ftp://example.com", "not a site"]) {
      expect(vcardPayloadSchema.safeParse(card({ firstName: "Ada", website })).success).toBe(false);
    }
  });

  test("checks the email and phone numbers only when set", () => {
    expect(vcardPayloadSchema.safeParse(card({ firstName: "Ada", email: "nope" })).success).toBe(
      false,
    );
    expect(vcardPayloadSchema.safeParse(card({ firstName: "Ada", phone: "call me" })).success).toBe(
      false,
    );
    expect(
      vcardPayloadSchema.safeParse(card({ firstName: "Ada", phone: "+1 (415) 555-0100" })).success,
    ).toBe(true);
  });
});

describe("helpers", () => {
  test("telHref keeps only digits and the plus sign", () => {
    expect(telHref("+1 (415) 555-0100")).toBe("tel:+14155550100");
  });

  test("vcardSummary adds the organisation to a person's name", () => {
    expect(vcardSummary(card({ firstName: "Ada", organization: "Acme" }))).toBe("Ada · Acme");
    expect(vcardSummary(card({ organization: "Acme" }))).toBe("Acme");
  });

  test("vcardFileName keeps letters in any script and drops path characters", () => {
    expect(vcardFileName(card({ firstName: "José", lastName: "Ñúñez" }))).toBe("José Ñúñez.vcf");
    expect(vcardFileName(card({ firstName: "../a/b" }))).toBe("ab.vcf");
    expect(vcardFileName(card({ firstName: "///" }))).toBe("contact.vcf");
  });
});
