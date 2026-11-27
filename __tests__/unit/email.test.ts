// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { sendEmail } from "@/lib/email";

const { constructResend, send } = vi.hoisted(() => ({
  constructResend: vi.fn(),
  send: vi.fn(),
}));

vi.mock("resend", () => {
  class Resend {
    emails = { send };

    constructor(key?: string) {
      constructResend(key);
    }
  }
  return { default: Resend, Resend };
});

const FROM = "GerenTés de AdvienTé <gerente@adviente.carlosca.net>";
const API_KEY = "re_unit_test_key";

const message = {
  html: '<p>Restablece tu contraseña: <a href="https://adviente.test/reset-password/html-token-123">enlace</a></p>',
  subject: "Restablece tu contraseña subject-token-456",
  text: "Restablece tu contraseña: https://adviente.test/reset-password/text-token-789",
  to: "persona@example.com",
};

function sentPayload() {
  return send.mock.calls[0][0];
}

describe("sendEmail", () => {
  let consoleSpies: MockInstance[];

  beforeEach(() => {
    constructResend.mockReset();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    vi.stubEnv("RESEND_API_KEY", API_KEY);
    vi.stubEnv("EMAIL_REPLY_TO", undefined);
    consoleSpies = (["error", "warn", "log", "info", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const spy of consoleSpies) {
      spy.mockRestore();
    }
  });

  function expectNoConsoleOutput() {
    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  }

  describe("module load", () => {
    it("imports without throwing and without creating a client when no env is set", async () => {
      vi.stubEnv("RESEND_API_KEY", undefined);
      vi.stubEnv("EMAIL_REPLY_TO", undefined);
      vi.resetModules();

      const emailModule = await import("@/lib/email");

      expect(typeof emailModule.sendEmail).toBe("function");
      expect(constructResend).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("API key", () => {
    it("throws an Error naming RESEND_API_KEY and never calls Resend when the key is missing", async () => {
      vi.stubEnv("RESEND_API_KEY", undefined);

      const error = await sendEmail(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("RESEND_API_KEY");
      expect(constructResend).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it("throws an Error naming RESEND_API_KEY and never calls Resend when the key is empty", async () => {
      vi.stubEnv("RESEND_API_KEY", "");

      const error = await sendEmail(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("RESEND_API_KEY");
      expect(constructResend).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it("passes the key to the Resend constructor", async () => {
      await sendEmail(message);

      expect(constructResend).toHaveBeenCalledTimes(1);
      expect(constructResend).toHaveBeenCalledWith(API_KEY);
    });

    it("creates a client on every call with the key read at that moment", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_first_key");
      await sendEmail(message);

      vi.stubEnv("RESEND_API_KEY", "re_second_key");
      await sendEmail(message);

      expect(constructResend).toHaveBeenCalledTimes(2);
      expect(constructResend).toHaveBeenNthCalledWith(1, "re_first_key");
      expect(constructResend).toHaveBeenNthCalledWith(2, "re_second_key");
      expect(send).toHaveBeenCalledTimes(2);
    });

    it("fails on a later call once the key is removed, without calling Resend again", async () => {
      await sendEmail(message);

      vi.stubEnv("RESEND_API_KEY", undefined);

      await expect(sendEmail(message)).rejects.toThrow("RESEND_API_KEY");
      expect(constructResend).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe("payload", () => {
    it("sends exactly from, to, subject, html and text, with no replyTo when EMAIL_REPLY_TO is unset", async () => {
      await sendEmail(message);

      expect(send).toHaveBeenCalledTimes(1);
      expect(sentPayload()).toStrictEqual({
        from: FROM,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
      expect(sentPayload()).not.toHaveProperty("replyTo");
    });

    it("leaves replyTo out when EMAIL_REPLY_TO is empty", async () => {
      vi.stubEnv("EMAIL_REPLY_TO", "");

      await sendEmail(message);

      expect(sentPayload()).toStrictEqual({
        from: FROM,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
      expect(sentPayload()).not.toHaveProperty("replyTo");
    });

    it("leaves replyTo out when EMAIL_REPLY_TO is only whitespace", async () => {
      vi.stubEnv("EMAIL_REPLY_TO", "   \t ");

      await sendEmail(message);

      expect(sentPayload()).not.toHaveProperty("replyTo");
      expect(sentPayload()).toStrictEqual({
        from: FROM,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    });

    it("adds the trimmed EMAIL_REPLY_TO as replyTo", async () => {
      vi.stubEnv("EMAIL_REPLY_TO", "  respuestas@example.com  ");

      await sendEmail(message);

      expect(send).toHaveBeenCalledTimes(1);
      expect(sentPayload()).toStrictEqual({
        from: FROM,
        html: message.html,
        replyTo: "respuestas@example.com",
        subject: message.subject,
        text: message.text,
        to: message.to,
      });
    });

    it("reads EMAIL_REPLY_TO on every call", async () => {
      vi.stubEnv("EMAIL_REPLY_TO", "primero@example.com");
      await sendEmail(message);

      vi.stubEnv("EMAIL_REPLY_TO", undefined);
      await sendEmail(message);

      vi.stubEnv("EMAIL_REPLY_TO", "segundo@example.com");
      await sendEmail(message);

      expect(send).toHaveBeenCalledTimes(3);
      expect(send.mock.calls[0][0]).toHaveProperty("replyTo", "primero@example.com");
      expect(send.mock.calls[1][0]).not.toHaveProperty("replyTo");
      expect(send.mock.calls[2][0]).toHaveProperty("replyTo", "segundo@example.com");
    });

    it("passes the message fields through unchanged", async () => {
      const unusual = {
        html: "  <div>\n  Té & café «ñ»  </div>\n",
        subject: "  Asunto con espacios  ",
        text: "\n  línea uno\n  línea dos  \n",
        to: "  Mayúsculas@Example.COM ",
      };

      await sendEmail(unusual);

      expect(sentPayload()).toStrictEqual({ from: FROM, ...unusual });
    });
  });

  describe("result", () => {
    it("resolves undefined when Resend answers without an error", async () => {
      await expect(sendEmail(message)).resolves.toBeUndefined();
      expectNoConsoleOutput();
    });

    it("rejects with an Error carrying Resend's error name and message when Resend answers with an error", async () => {
      send.mockResolvedValueOnce({
        data: null,
        error: { message: "The to field is invalid.", name: "validation_error", statusCode: 422 },
      });

      const error = await sendEmail(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("validation_error");
      expect((error as Error).message).toContain("The to field is invalid.");
    });

    it("never puts the html, text or subject in the error message", async () => {
      send.mockResolvedValueOnce({
        data: null,
        error: { message: "API key is invalid", name: "invalid_api_key", statusCode: 403 },
      });

      const error = await sendEmail(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).not.toContain(message.html);
      expect(errorMessage).not.toContain(message.text);
      expect(errorMessage).not.toContain(message.subject);
      expect(errorMessage).not.toContain("html-token-123");
      expect(errorMessage).not.toContain("text-token-789");
      expect(errorMessage).not.toContain("subject-token-456");
    });

    it("propagates a rejection from send", async () => {
      send.mockRejectedValueOnce(new Error("network down"));

      await expect(sendEmail(message)).rejects.toThrow("network down");
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe("logging", () => {
    it("writes nothing to the console on success, Resend errors, rejections or a missing key", async () => {
      await sendEmail(message);

      send.mockResolvedValueOnce({
        data: null,
        error: { message: "Too many requests", name: "rate_limit_exceeded", statusCode: 429 },
      });
      await sendEmail(message).catch(() => {});

      send.mockRejectedValueOnce(new Error("network down"));
      await sendEmail(message).catch(() => {});

      vi.stubEnv("RESEND_API_KEY", undefined);
      await sendEmail(message).catch(() => {});

      expectNoConsoleOutput();
    });
  });
});
