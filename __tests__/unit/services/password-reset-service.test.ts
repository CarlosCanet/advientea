// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { sendResetPasswordEmail } from "@/lib/services/password-reset-service";

const { sendEmail, toResetPasswordEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  toResetPasswordEmail: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/email-templates/reset-password", () => ({ toResetPasswordEmail }));

const TOKEN = "Zq81TokenNobodyMayLog42";
const URL_WITH_TOKEN = `https://adviente.vercel.app/api/auth/reset-password/${TOKEN}?callbackURL=%2Freset-password`;
const USER = { email: "ana.reset@example.com", name: "AnaReset" };
const EMAIL = {
  html: "<p>Restablece tu contraseña</p>",
  subject: "Restablece tu contraseña de Advienté",
  text: "Restablece tu contraseña",
};
const FAILURE_PREFIX = "[sendResetPasswordEmail] failed";
const CONSOLE_METHODS = ["debug", "error", "info", "log", "trace", "warn"] as const;

type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

let consoleSpies: Record<ConsoleMethod, MockInstance>;

function toLoggedText(value: unknown): string {
  if (value instanceof Error) {
    return [value.name, value.message, value.stack ?? "", toLoggedText(value.cause)].join(" ");
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Everything passed to any console method, as one string. */
function allLoggedText() {
  return CONSOLE_METHODS.flatMap((method) => consoleSpies[method].mock.calls.flat().map(toLoggedText)).join("\n");
}

function totalConsoleCalls() {
  return CONSOLE_METHODS.reduce((total, method) => total + consoleSpies[method].mock.calls.length, 0);
}

function expectNothingSensitiveLogged() {
  const logged = allLoggedText();
  expect(logged).not.toContain(URL_WITH_TOKEN);
  expect(logged).not.toContain(TOKEN);
  expect(logged).not.toContain(USER.email);
}

function expectOneFailureLog(error: unknown) {
  expect(consoleSpies.error).toHaveBeenCalledTimes(1);
  const [first, ...rest] = consoleSpies.error.mock.calls[0];
  expect(typeof first).toBe("string");
  expect((first as string).startsWith(FAILURE_PREFIX)).toBe(true);
  expect(rest).toContain(error);
  expect(totalConsoleCalls()).toBe(1);
}

describe("sendResetPasswordEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toResetPasswordEmail.mockReturnValue(EMAIL);
    sendEmail.mockResolvedValue(undefined);
    consoleSpies = {} as Record<ConsoleMethod, MockInstance>;
    for (const method of CONSOLE_METHODS) {
      consoleSpies[method] = vi.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("on success", () => {
    it("builds the email from the url and the user's name", async () => {
      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expect(toResetPasswordEmail).toHaveBeenCalledTimes(1);
      expect(toResetPasswordEmail).toHaveBeenCalledWith({ url: URL_WITH_TOKEN, username: USER.name });
    });

    it("sends exactly the template's html, subject and text to the user's email", async () => {
      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith({ ...EMAIL, to: USER.email });
      expect(Object.keys(sendEmail.mock.calls[0][0]).sort()).toEqual(["html", "subject", "text", "to"]);
    });

    it("passes only the name to the template, so the user's email never reaches it", async () => {
      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: { ...USER, name: "Otra" } });

      expect(toResetPasswordEmail).toHaveBeenCalledWith({ url: URL_WITH_TOKEN, username: "Otra" });
      expect(JSON.stringify(toResetPasswordEmail.mock.calls[0])).not.toContain(USER.email);
    });

    it("builds the email before sending it", async () => {
      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expect(toResetPasswordEmail.mock.invocationCallOrder[0]).toBeLessThan(sendEmail.mock.invocationCallOrder[0]);
    });

    it("waits for the send before resolving", async () => {
      let finishSend: () => void = () => {};
      sendEmail.mockReturnValue(
        new Promise<void>((resolve) => {
          finishSend = resolve;
        }),
      );
      let settled = false;

      const pending = sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER }).then(() => {
        settled = true;
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(settled).toBe(false);
      finishSend();
      await pending;
      expect(settled).toBe(true);
    });

    it("resolves undefined", async () => {
      await expect(sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER })).resolves.toBeUndefined();
    });

    it("logs nothing", async () => {
      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expect(totalConsoleCalls()).toBe(0);
    });
  });

  describe("when the send rejects", () => {
    it("resolves undefined instead of rejecting", async () => {
      sendEmail.mockRejectedValue(new Error("Resend unavailable"));

      await expect(sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER })).resolves.toBeUndefined();
    });

    it("logs the error once with the failure prefix", async () => {
      const error = new Error("Resend unavailable");
      sendEmail.mockRejectedValue(error);

      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expectOneFailureLog(error);
    });

    it("logs neither the url, nor the token, nor the user's email", async () => {
      sendEmail.mockRejectedValue(new Error("Resend unavailable"));

      await sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER });

      expectNothingSensitiveLogged();
    });

    it("also survives a rejection that is not an Error", async () => {
      sendEmail.mockRejectedValue("timeout");

      await expect(sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER })).resolves.toBeUndefined();
      expectOneFailureLog("timeout");
      expectNothingSensitiveLogged();
    });
  });

  describe("when the send throws synchronously", () => {
    it("resolves undefined and logs the error once", async () => {
      const error = new Error("missing RESEND_API_KEY");
      sendEmail.mockImplementation(() => {
        throw error;
      });

      await expect(sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER })).resolves.toBeUndefined();
      expectOneFailureLog(error);
      expectNothingSensitiveLogged();
    });
  });

  describe("when building the email throws", () => {
    it("resolves undefined, logs the error once and does not send", async () => {
      const error = new Error("template broke");
      toResetPasswordEmail.mockImplementation(() => {
        throw error;
      });

      await expect(sendResetPasswordEmail({ url: URL_WITH_TOKEN, user: USER })).resolves.toBeUndefined();
      expect(sendEmail).not.toHaveBeenCalled();
      expectOneFailureLog(error);
      expectNothingSensitiveLogged();
    });
  });
});
