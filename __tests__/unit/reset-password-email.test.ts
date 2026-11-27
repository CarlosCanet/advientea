// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { toResetPasswordEmail } from "@/lib/email-templates/reset-password";

const URL_WITH_AMPERSAND =
  "https://adviente.vercel.app/api/auth/reset-password/T0K3N?callbackURL=%2Freset-password&lang=es";
const ESCAPED_URL_WITH_AMPERSAND =
  "https://adviente.vercel.app/api/auth/reset-password/T0K3N?callbackURL=%2Freset-password&amp;lang=es";
const SPEC_URL = "https://adviente.vercel.app/api/auth/reset-password/T0K3N?callbackURL=%2Freset-password";

// React may split adjacent text nodes with `<!-- -->`; what a reader sees is the text without them.
function toVisibleMarkup(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function toTextContent(html: string): string {
  return toVisibleMarkup(html).replace(/<[^>]*>/g, "");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("toResetPasswordEmail", () => {
  it("uses the exact Spanish subject, whatever the user", async () => {
    const forAna = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });
    const forLuis = await toResetPasswordEmail({ url: URL_WITH_AMPERSAND, username: "Luis" });

    expect(forAna.subject).toBe("Recuperar tu contraseña de Advienté");
    expect(forLuis.subject).toBe("Recuperar tu contraseña de Advienté");
  });

  describe("html", () => {
    it("is a full HTML document in Spanish", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });

      expect(html).toMatch(/<!DOCTYPE html/i);
      expect(html).toMatch(/<html[^>]*\slang="es"/);
      expect(html).toMatch(/<body[\s>]/);
      expect(html).toMatch(/<\/html>\s*$/);
    });

    it("links the button and a fallback link to the url, with the ampersand escaped", async () => {
      const { html } = await toResetPasswordEmail({ url: URL_WITH_AMPERSAND, username: "Ana" });

      expect(countOccurrences(html, `href="${ESCAPED_URL_WITH_AMPERSAND}"`)).toBeGreaterThanOrEqual(2);
      expect(html).not.toContain("callbackURL=%2Freset-password&lang=es");
    });

    it("shows the url as visible text", async () => {
      const { html } = await toResetPasswordEmail({ url: URL_WITH_AMPERSAND, username: "Ana" });

      expect(toTextContent(html)).toContain(ESCAPED_URL_WITH_AMPERSAND);
    });

    it("links the spec url verbatim when it has nothing to escape", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });

      expect(countOccurrences(html, `href="${SPEC_URL}"`)).toBeGreaterThanOrEqual(2);
      expect(toTextContent(html)).toContain(SPEC_URL);
    });

    it("greets the user by name", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });

      expect(toVisibleMarkup(html)).toContain("¡Hola, Ana!");
    });

    it("escapes a username that contains markup", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "<b>Ana</b>" });

      expect(html).not.toContain("<b>Ana</b>");
      expect(toVisibleMarkup(html)).toContain("¡Hola, &lt;b&gt;Ana&lt;/b&gt;!");
    });

    it("has the button label and says the link expires in one hour", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });
      const visible = toVisibleMarkup(html);

      expect(visible).toContain("Elegir contraseña nueva");
      expect(visible).toContain("caduca en una hora");
    });

    it("takes the logo from the origin of the url", async () => {
      const { html } = await toResetPasswordEmail({ url: SPEC_URL, username: "Ana" });

      expect(html).toMatch(/<img[^>]*\ssrc="https:\/\/adviente\.vercel\.app\/LogoAdvientea\.png"/);
    });

    it("keeps the scheme and port of the url's origin for the logo", async () => {
      const { html } = await toResetPasswordEmail({
        url: "http://localhost:3700/api/auth/reset-password/T0K3N?callbackURL=%2Freset-password",
        username: "Ana",
      });

      expect(html).toMatch(/<img[^>]*\ssrc="http:\/\/localhost:3700\/LogoAdvientea\.png"/);
      expect(html).not.toContain("adviente.vercel.app");
    });
  });

  describe("text", () => {
    it("contains the raw url, the greeting and the expiry notice", async () => {
      const { text } = await toResetPasswordEmail({ url: URL_WITH_AMPERSAND, username: "Ana" });

      expect(text).toContain(URL_WITH_AMPERSAND);
      expect(text).not.toContain("&amp;");
      expect(text).toContain("Hola, Ana");
      expect(text).toContain("caduca en una hora");
    });

    it("contains no HTML tags", async () => {
      const { text } = await toResetPasswordEmail({ url: URL_WITH_AMPERSAND, username: "Ana" });

      expect(text).not.toMatch(/<[a-zA-Z/]/);
    });

    it("keeps a username with markup as typed and has no other tags", async () => {
      const username = "<b>Ana</b>";
      const { text } = await toResetPasswordEmail({ url: SPEC_URL, username });

      expect(text).toContain(`Hola, ${username}`);
      expect(text.replaceAll(username, "")).not.toMatch(/<[a-zA-Z/]/);
    });
  });

  it.each(["/reset-password", "reset-password?token=T0K3N", ""])("rejects the relative url %j", async (url) => {
    await expect(toResetPasswordEmail({ url, username: "Ana" })).rejects.toThrow();
  });

  it("returns the same email for the same input", async () => {
    const input = { url: URL_WITH_AMPERSAND, username: "Ana" };

    const first = await toResetPasswordEmail(input);
    const second = await toResetPasswordEmail(input);

    expect(second).toEqual(first);
  });

  it("does not depend on the environment or the network", async () => {
    const input = { url: SPEC_URL, username: "Ana" };
    const baseline = await toResetPasswordEmail(input);

    const fetchSpy = vi.fn(() => Promise.reject(new Error("network is not allowed")));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("BETTER_AUTH_URL", "https://other.example");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://other.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://other.example");
    vi.stubEnv("VERCEL_URL", "other.example");
    vi.stubEnv("VERCEL_ENV", "preview");

    const withOtherEnvironment = await toResetPasswordEmail(input);

    expect(withOtherEnvironment).toEqual(baseline);
    expect(withOtherEnvironment.html).not.toContain("other.example");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
