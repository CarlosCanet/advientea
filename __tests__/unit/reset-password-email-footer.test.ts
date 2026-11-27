// @vitest-environment node
import { describe, expect, it } from "vitest";

import { toResetPasswordEmail } from "@/lib/email-templates/reset-password";
import { EMAIL_THEME } from "@/lib/email-templates/theme";

const URL = "https://adviente.vercel.app/api/auth/reset-password/T0K3N?callbackURL=%2Freset-password";
const NO_REPLY_NOTICE =
  "No respondas a este correo. Si necesitas ayuda, habla con quien gestione el calendario este año.";

// React may split adjacent text nodes with `<!-- -->`; what a reader sees is the text without them.
function toVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ");
}

function toEscapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("toResetPasswordEmail layout", () => {
  it("declares Spanish and never English as the language", async () => {
    const { html } = await toResetPasswordEmail({ url: URL, username: "Ana" });

    expect(html).toContain('lang="es"');
    expect(html).not.toContain('lang="en"');
  });

  it("draws the divider with the theme's border colour", async () => {
    const { html } = await toResetPasswordEmail({ url: URL, username: "Ana" });

    expect(EMAIL_THEME.border).toEqual(expect.any(String));
    expect(html).toMatch(new RegExp(`border-top(-color)?\\s*:[^;"]*${toEscapedRegExp(EMAIL_THEME.border)}`, "i"));
  });

  it("no longer uses the default grey of the divider", async () => {
    const { html } = await toResetPasswordEmail({ url: URL, username: "Ana" });

    expect(html).not.toMatch(/#eaeaea/i);
  });

  it("tells the reader not to reply, in the html", async () => {
    const { html } = await toResetPasswordEmail({ url: URL, username: "Ana" });

    expect(toVisibleText(html)).toContain(NO_REPLY_NOTICE);
  });

  it("tells the reader not to reply, in the text", async () => {
    const { text } = await toResetPasswordEmail({ url: URL, username: "Ana" });

    expect(text.replace(/\s+/g, " ")).toContain(NO_REPLY_NOTICE);
  });
});
