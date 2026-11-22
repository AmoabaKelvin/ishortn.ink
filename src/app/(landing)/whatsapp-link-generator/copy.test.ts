import { describe, expect, it } from "bun:test";

import { phoneNoteText, whatsappToolCopy } from "./copy";
import { normalizePhone } from "./utils";

import type { WhatsAppToolCopy } from "./copy";
import type { PhoneError, PhoneNote } from "./utils";

const { en, "pt-BR": ptBR } = whatsappToolCopy;
const locales = [en, ptBR];

const PHONE_ERRORS: PhoneError[] = ["too_short", "too_long", "invalid_chars", "no_country"];
const PHONE_NOTES: PhoneNote[] = [
  { code: "dial_already_included", dial: "55" },
  { code: "argentina_mobile" },
];

// The templates, filled in with sample values.
const templates = (copy: WhatsAppToolCopy) => [
  copy.notes.dial_already_included("55"),
  copy.characters("612"),
  copy.qrCodeFor("https://wa.me/5511912345678"),
  copy.upgradeBody(30, 5),
];

describe("WhatsApp tool copy", () => {
  it("translates every string the English tool has", () => {
    expect(Object.keys(ptBR)).toEqual(Object.keys(en));
    expect(Object.keys(ptBR.errors)).toEqual(Object.keys(en.errors));
    expect(Object.keys(ptBR.notes)).toEqual(Object.keys(en.notes));
    expect(Object.keys(ptBR.pro)).toEqual(Object.keys(en.pro));
    expect(ptBR.quickFills).toHaveLength(en.quickFills.length);
  });

  it("has no empty strings", () => {
    for (const copy of locales) {
      // JSON keeps every string value (templates aside); an empty or blank one ends with `"` + , } ].
      expect(JSON.stringify(copy)).not.toMatch(/:"\s*"(?=[,}\]])/);
      for (const text of templates(copy)) expect(text.trim()).not.toBe("");
    }
  });

  it("fills in the template values", () => {
    for (const copy of locales) {
      const [note, characters, qrLabel, upgrade] = templates(copy);
      expect(note).toContain("+55");
      expect(characters).toContain("612");
      expect(qrLabel).toContain("https://wa.me/5511912345678");
      expect(upgrade).toContain(" 30 ");
      expect(upgrade).toContain(" 5 ");
    }
  });

  it("has text for every phone error and note in both locales", () => {
    for (const copy of locales) {
      for (const error of PHONE_ERRORS) expect(copy.errors[error]).toBeTruthy();
      for (const note of PHONE_NOTES) expect(phoneNoteText(copy, note)).toBeTruthy();
    }
  });

  it("covers every error normalizePhone returns", () => {
    const cases: [string, string][] = [
      ["12345", "44"],
      [`+${"1".repeat(16)}`, ""],
      ["12a", "44"],
      ["7700 900123", ""],
    ];
    const errors = cases.map(([input, dial]) => {
      const result = normalizePhone(input, dial);
      return result.ok ? null : result.error;
    });
    expect(errors).toEqual(PHONE_ERRORS);
  });

  it("keeps the openers that leave the caret at the end", () => {
    expect(ptBR.quickFills.map((fill) => fill.text.endsWith(" "))).toEqual(
      en.quickFills.map((fill) => fill.text.endsWith(" ")),
    );
  });

  it("only notes the English dashboard on translated pages", () => {
    expect(en.dashboardNote).toBeNull();
    expect(ptBR.dashboardNote).toContain("Create Link");
  });
});
