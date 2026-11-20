import { describe, expect, it } from "vitest";

import { toParticipantName } from "@/lib/utils";

describe("toParticipantName", () => {
  it("uses the username of the account", () => {
    expect(toParticipantName({ guestName: null, user: { username: "Ana" } })).toBe("Ana");
  });

  it("uses the guest name when there is no account", () => {
    expect(toParticipantName({ guestName: "Prima Lejana", user: null })).toBe("Prima Lejana");
  });

  it("prefers the account when both are present", () => {
    expect(toParticipantName({ guestName: "Prima Lejana", user: { username: "Ana" } })).toBe("Ana");
  });

  it("returns null when the account was deleted and there is no guest name", () => {
    expect(toParticipantName({ guestName: null, user: null })).toBeNull();
  });
});
