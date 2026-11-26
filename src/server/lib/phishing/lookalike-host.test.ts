import { describe, expect, test } from "bun:test";

import { findLookalikeBrand } from "./lookalike-host";

describe("findLookalikeBrand", () => {
  test.each([
    ["internationalcard.servicebericht.org", "internationalcard"],
    ["lnternationalcard.servicesportal.im", "lnternationalcard"],
    ["itsme-id.service-online.im", "itsme"],
    ["lcscards.nl-serviceportaal.org", "lcscards"],
    ["icscards-beveiliging.com", "icscards"],
    ["mijn.sumup-verify.net", "sumup"],
    ["paylife.at-kundenservice.com", "paylife"],
    ["belastingdienst.teruggave-online.nl", "belastingdienst"],
    ["fluvius-terugbetaling.be", "fluvius"],
    ["login.bitvavo.app", "bitvavo"],
    ["rabobank-beveiliging.nl", "rabobank"],
    ["abnamro.secure-login.info", "abnamro"],
    ["bunq-support.com", "bunq"],
    ["americanexpress.account-check.io", "americanexpress"],
    ["secure.american-express-login.com", "american-express"],
    ["ics.nl-serviceportaal.org", "ics"],
    ["ing-authenticeren.com", "ing"],
    ["lcs.doorsturen.org", "lcs"],
    ["ing.beschikking-online.net", "ing"],
    ["ics-redirect.com", "ics"],
    ["INTERNATIONALCARD.ServiceBericht.org.", "internationalcard"],
  ])("flags %s", (host, brand) => {
    expect(findLookalikeBrand(host)).toBe(brand);
  });

  test.each([
    "icscards.nl",
    "www.icscards.nl",
    "itsme-id.com",
    "www.itsme-id.com",
    "sumup.com",
    "me.sumup.com",
    "paylife.at",
    "www.belastingdienst.nl",
    "mijn.fluvius.be",
    "bitvavo.com",
    "account.bitvavo.com",
    "ing.nl",
    "mijn.ing.nl",
    "www.ing.com",
    "www.rabobank.nl",
    "www.abnamro.nl",
    "bunq.com",
    "global.americanexpress.com",
  ])("allows the official host %s", (host) => {
    expect(findLookalikeBrand(host)).toBeNull();
  });

  test.each([
    "physics.org",
    "singapore.com",
    "ingredients.com",
    "thing.com",
    "sing.example.com",
    "lyrics.com",
    "topics.example.org",
    "ics.uci.edu",
    "ing.example.com",
    "ics-cert.org",
    "lcs.k12.example.us",
    "example.com",
    "sumupthings.com",
    "redirect.example.com",
    "serviceportaal.example.nl",
  ])("does not flag %s", (host) => {
    expect(findLookalikeBrand(host)).toBeNull();
  });

  test("takes well under 1 ms per host", () => {
    const hosts = ["internationalcard.servicebericht.org", "singapore.com", "mijn.ing.nl"];
    const runs = 3000;
    const started = performance.now();
    for (let i = 0; i < runs; i++) findLookalikeBrand(hosts[i % hosts.length]!);
    expect((performance.now() - started) / runs).toBeLessThan(1);
  });
});
