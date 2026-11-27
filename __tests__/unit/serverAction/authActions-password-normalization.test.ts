import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { resetPasswordAction, signin, updateUserProfile } from "@/app/actions/authActions";
import { auth } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";
import { editUser, requireSession } from "@/lib/dal";
import { assertWithinRateLimit, getClientIP } from "@/lib/services/rate-limit-service";

vi.mock("@/lib/services/rate-limit-service", () => ({
  assertWithinRateLimit: vi.fn(),
  getClientIP: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      changePassword: vi.fn(),
      getSession: vi.fn().mockResolvedValue(null),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/user-service", () => ({ createUser: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  changeUserRole: vi.fn(),
  consumeRateLimit: vi.fn(),
  editUser: vi.fn(),
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({
  // Like Next.js: redirect never returns, it throws an error the framework recognises.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined, getAll: () => [], has: () => false }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const EMAIL = "ana@example.com";
const IP = "203.0.113.7";
const E_NFC = "é";
const E_NFD = "é";
// "Tétera2026!" typed with a decomposed "é" and padded with spaces, and the form it must reach better-auth in.
const TYPED_PASSWORD = `  T${E_NFD}tera2026!  `;
const NORMALISED_PASSWORD = `T${E_NFC}tera2026!`;

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getClientIP).mockResolvedValue(IP);
  vi.mocked(assertWithinRateLimit).mockResolvedValue(undefined);
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe("signin password normalisation", () => {
  function signinForm(email: string, password: string) {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    return formData;
  }

  beforeEach(() => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue({} as never);
  });

  it("signs in with the password trimmed and in NFC", async () => {
    await signin(null, signinForm(EMAIL, TYPED_PASSWORD)).catch(() => undefined);

    expect(auth.api.signInEmail).toHaveBeenCalledOnce();
    expect(auth.api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ password: NORMALISED_PASSWORD }) }),
    );
  });

  it("keeps the inner whitespace of the password", async () => {
    await signin(null, signinForm(EMAIL, " Mi clave 2026! ")).catch(() => undefined);

    expect(auth.api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ password: "Mi clave 2026!" }) }),
    );
  });

  it("gives the rate limit and better-auth the email unchanged", async () => {
    await signin(null, signinForm(EMAIL, TYPED_PASSWORD)).catch(() => undefined);

    expect(assertWithinRateLimit).toHaveBeenCalledWith("signin", { email: EMAIL, ip: IP });
    expect(auth.api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ email: EMAIL }) }),
    );
  });
});

describe("updateUserProfile password normalisation", () => {
  const USER_ID = "user-1";
  const OLD_AVATAR = "advientea-local/avatars/old";
  const NEW_AVATAR = "advientea-local/avatars/new";
  const INITIAL_STATE = { message: "", success: false };
  const session = {
    isAuth: true as const,
    role: "USER" as const,
    user: { email: EMAIL, id: USER_ID, image: OLD_AVATAR, name: "Ana", username: "Ana" },
    userId: USER_ID,
  };
  type Session = Awaited<ReturnType<typeof requireSession>>;
  type ProfileField = "currentPassword" | "newPassword" | "newPasswordConfirmation" | "username";

  function avatarFile() {
    return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "avatar.png", {
      type: "image/png",
    });
  }

  /** A profile form as the page sends it: the password fields always present, empty when unchanged. */
  function profileForm(fields: Partial<Record<ProfileField, string>> = {}) {
    const formData = new FormData();
    const values = { currentPassword: "", newPassword: "", newPasswordConfirmation: "", username: "Ana", ...fields };
    for (const [key, value] of Object.entries(values)) {
      formData.append(key, value);
    }
    formData.append("image", avatarFile());
    return formData;
  }

  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue(session as unknown as Session);
    vi.mocked(uploadImage).mockResolvedValue(NEW_AVATAR);
    vi.mocked(auth.api.changePassword).mockResolvedValue({ token: null, user: {} } as never);
    vi.mocked(editUser).mockResolvedValue({ id: USER_ID, image: NEW_AVATAR, username: "Ana" } as never);
  });

  it("changes the password with the current and the new password trimmed and in NFC", async () => {
    await updateUserProfile(
      INITIAL_STATE,
      profileForm({
        currentPassword: `  Act${E_NFD}al123!  `,
        newPassword: TYPED_PASSWORD,
        newPasswordConfirmation: NORMALISED_PASSWORD,
      }),
    ).catch(() => undefined);

    expect(auth.api.changePassword).toHaveBeenCalledOnce();
    expect(auth.api.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ currentPassword: `Act${E_NFC}al123!`, newPassword: NORMALISED_PASSWORD }),
      }),
    );
  });

  it("keeps the current password when the new one is whitespace only", async () => {
    await updateUserProfile(
      INITIAL_STATE,
      profileForm({ currentPassword: "", newPassword: "   ", newPasswordConfirmation: "" }),
    ).catch(() => undefined);

    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(auth.api.changePassword).not.toHaveBeenCalled();
  });
});

describe("resetPasswordAction password normalisation", () => {
  const TOKEN = "rst7Kq2ZxV9pLm4Wn8Tb";

  function resetForm(newPassword: string, newPasswordConfirmation: string) {
    const formData = new FormData();
    formData.append("newPassword", newPassword);
    formData.append("newPasswordConfirmation", newPasswordConfirmation);
    formData.append("token", TOKEN);
    return formData;
  }

  beforeEach(() => {
    vi.mocked(auth.api.resetPassword).mockResolvedValue({ status: true } as never);
  });

  it("hands better-auth the new password trimmed and in NFC", async () => {
    await resetPasswordAction(null, resetForm(TYPED_PASSWORD, NORMALISED_PASSWORD)).catch(() => undefined);

    expect(vi.mocked(auth.api.resetPassword).mock.calls).toStrictEqual([
      [{ body: { newPassword: NORMALISED_PASSWORD, token: TOKEN } }],
    ]);
  });

  it("accepts an NFC password confirmed in NFD with padding", async () => {
    await resetPasswordAction(null, resetForm(NORMALISED_PASSWORD, TYPED_PASSWORD)).catch(() => undefined);

    expect(vi.mocked(auth.api.resetPassword).mock.calls).toStrictEqual([
      [{ body: { newPassword: NORMALISED_PASSWORD, token: TOKEN } }],
    ]);
  });
});
