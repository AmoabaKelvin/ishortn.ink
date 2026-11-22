import { describe, expect, test } from "bun:test";

import { getUserInfo } from "./user-info";

function event(firstName: string | null, lastName: string | null) {
  return {
    type: "user.created",
    data: {
      id: "user_1",
      first_name: firstName,
      last_name: lastName,
      image_url: "https://img.clerk.com/a.png",
      primary_email_address_id: "idn_2",
      email_addresses: [
        { id: "idn_1", email_address: "old@example.com" },
        { id: "idn_2", email_address: "ama@example.com" },
      ],
    },
  };
}

describe("getUserInfo", () => {
  test("stores no name when both parts are null", () => {
    expect(getUserInfo(event(null, null)).name).toBeNull();
  });

  test("stores only the part that is set", () => {
    expect(getUserInfo(event("Ama", null)).name).toBe("Ama");
    expect(getUserInfo(event(null, "Mensah")).name).toBe("Mensah");
  });

  test("joins both parts when set", () => {
    expect(getUserInfo(event("Ama", "Mensah")).name).toBe("Ama Mensah");
  });

  test("uses the primary email address", () => {
    expect(getUserInfo(event("Ama", "Mensah"))).toEqual({
      name: "Ama Mensah",
      email: "ama@example.com",
      avatarUrl: "https://img.clerk.com/a.png",
    });
  });
});
