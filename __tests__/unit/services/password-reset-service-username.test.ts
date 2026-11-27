// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendResetPasswordEmail } from "@/lib/services/password-reset-service";

const { sendEmail, toResetPasswordEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  toResetPasswordEmail: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/email-templates/reset-password", () => ({ toResetPasswordEmail }));

const URL_WITH_TOKEN = "https://adviente.vercel.app/api/auth/reset-password/Zq81Token?callbackURL=%2Freset-password";
const EMAIL_ADDRESS = "ana.reset@example.com";
const NAME = "Ana García";
const EMAIL = {
  html: "<p>Restablece tu contraseña</p>",
  subject: "Restablece tu contraseña de Advienté",
  text: "Restablece tu contraseña",
};

describe("sendResetPasswordEmail greeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toResetPasswordEmail.mockReturnValue(EMAIL);
    sendEmail.mockResolvedValue(undefined);
    for (const method of ["debug", "error", "info", "log", "warn"] as const) {
      vi.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("greets the user by username when it is a non-empty string", async () => {
    await sendResetPasswordEmail({
      url: URL_WITH_TOKEN,
      user: { email: EMAIL_ADDRESS, name: NAME, username: "anita" },
    });

    expect(toResetPasswordEmail).toHaveBeenCalledTimes(1);
    expect(toResetPasswordEmail).toHaveBeenCalledWith({ url: URL_WITH_TOKEN, username: "anita" });
  });

  it("greets the user by name when there is no username", async () => {
    await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: { email: EMAIL_ADDRESS, name: NAME } });

    expect(toResetPasswordEmail).toHaveBeenCalledWith({ url: URL_WITH_TOKEN, username: NAME });
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
    ["a number", 42],
    ["an object", { value: "anita" }],
    ["a boolean", true],
  ])("greets the user by name when the username is %s", async (_label, username) => {
    await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: { email: EMAIL_ADDRESS, name: NAME, username } });

    expect(toResetPasswordEmail).toHaveBeenCalledWith({ url: URL_WITH_TOKEN, username: NAME });
  });

  it("still sends the email to the user's address when greeting by username", async () => {
    await sendResetPasswordEmail({
      url: URL_WITH_TOKEN,
      user: { email: EMAIL_ADDRESS, name: NAME, username: "anita" },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({ ...EMAIL, to: EMAIL_ADDRESS });
  });

  it("never rejects when the send fails, whatever the username", async () => {
    sendEmail.mockRejectedValue(new Error("Resend unavailable"));

    await expect(
      sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: { email: EMAIL_ADDRESS, name: NAME, username: "anita" } }),
    ).resolves.toBeUndefined();
  });
});
