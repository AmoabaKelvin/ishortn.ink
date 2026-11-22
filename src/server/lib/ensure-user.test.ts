import { describe, expect, test } from "bun:test";

import { profileValues } from "./ensure-user";

function profile(firstName: string | null, lastName: string | null) {
  return {
    firstName,
    lastName,
    imageUrl: "https://img.clerk.com/a.png",
    primaryEmailAddressId: "idn_2",
    emailAddresses: [
      { id: "idn_1", emailAddress: "old@example.com" },
      { id: "idn_2", emailAddress: "ama@example.com" },
    ],
  };
}

describe("profileValues", () => {
  // User.name is NOT NULL in production, so a null here fails the insert.
  test("writes an empty name, not null, for a nameless email sign-up", () => {
    expect(profileValues(profile(null, null))?.name).toBe("");
  });

  test("writes the joined name and the primary email", () => {
    expect(profileValues(profile("Ama", "Mensah"))).toEqual({
      name: "Ama Mensah",
      email: "ama@example.com",
      imageUrl: "https://img.clerk.com/a.png",
    });
  });

  test("falls back to the first email when there is no primary", () => {
    expect(profileValues({ ...profile("Ama", null), primaryEmailAddressId: null })?.email).toBe(
      "old@example.com",
    );
  });

  // User.email is NOT NULL, so ensureUser must not attempt the insert.
  test("returns null when the profile has no email address", () => {
    expect(profileValues({ ...profile("Ama", null), emailAddresses: [] })).toBeNull();
  });
});
