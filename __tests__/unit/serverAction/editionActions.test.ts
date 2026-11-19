import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeEditionStatusAction, enrolGuestAction, enrolUserAction } from "@/app/actions/editionActions";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { changeEditionStatus, enrolGuest, enrolUser, requireRole } from "@/lib/dal";
import { ConflictError } from "@/lib/errors";

vi.mock("@/lib/dal", () => ({
  changeEditionStatus: vi.fn(),
  createEdition: vi.fn(),
  deleteEdition: vi.fn(),
  enrolGuest: vi.fn(),
  enrolUser: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("changeEditionStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
  });

  it("changes the status and says what the edition is now", async () => {
    const result = await changeEditionStatusAction(2026, EditionStatus.ACTIVE);

    expect(changeEditionStatus).toHaveBeenCalledWith(2026, EditionStatus.ACTIVE);
    expect(result).toEqual({ message: "La edición 2026 ahora está activa.", success: true });
  });

  it("refuses a status or a year that is not valid before reaching the DAL", async () => {
    const badStatus = await changeEditionStatusAction(2026, "DELETED" as EditionStatus);
    const badYear = await changeEditionStatusAction(2026.5, EditionStatus.ACTIVE);

    expect(badStatus.success).toBe(false);
    expect(badYear.success).toBe(false);
    expect(changeEditionStatus).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL", async () => {
    vi.mocked(changeEditionStatus).mockRejectedValue(new ConflictError("La edición 2025 está activa."));

    const result = await changeEditionStatusAction(2026, EditionStatus.ACTIVE);

    expect(result).toEqual({ message: "La edición 2025 está activa.", success: false });
  });
});

describe("enrolUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(enrolUser).mockResolvedValue({ id: "participation-id" } as Awaited<ReturnType<typeof enrolUser>>);
  });

  it("is open to the admin and to the calendar manager", async () => {
    await enrolUserAction(2026, "user-id");

    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN, Role.EXECUTEAVE);
  });

  it("enrols the user and refreshes the page of that edition", async () => {
    const result = await enrolUserAction(2026, "user-id");

    expect(enrolUser).toHaveBeenCalledWith(2026, "user-id");
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(result).toEqual({ message: "Persona inscrita en la edición 2026.", success: true });
  });

  it("refuses a year or a user that is not valid before reaching the DAL", async () => {
    const badYear = await enrolUserAction(2026.5, "user-id");
    const emptyUser = await enrolUserAction(2026, "");
    const notAString = await enrolUserAction(2026, 7 as unknown as string);

    expect(badYear.success).toBe(false);
    expect(emptyUser.success).toBe(false);
    expect(notAString.success).toBe(false);
    expect(enrolUser).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL", async () => {
    vi.mocked(enrolUser).mockRejectedValue(new ConflictError("La edición 2026 está archivada."));

    const result = await enrolUserAction(2026, "user-id");

    expect(result).toEqual({ message: "La edición 2026 está archivada.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hides an unexpected error behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(enrolUser).mockRejectedValue(new Error("connection refused"));

    const result = await enrolUserAction(2026, "user-id");

    expect(result.success).toBe(false);
    expect(result.message).not.toContain("connection refused");
  });
});

describe("enrolGuestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(enrolGuest).mockResolvedValue({
      guestName: "Prima Lejana",
      guestToken: "secret-token",
      id: "participation-id",
    } as Awaited<ReturnType<typeof enrolGuest>>);
  });

  it("is open to the admin and to the calendar manager", async () => {
    await enrolGuestAction(2026, "Prima Lejana");

    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN, Role.EXECUTEAVE);
  });

  it("enrols the guest, names them and refreshes the page of that edition", async () => {
    const result = await enrolGuestAction(2026, "Prima Lejana");

    expect(enrolGuest).toHaveBeenCalledWith(2026, "Prima Lejana");
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(result).toEqual({ message: "Prima Lejana está en la edición 2026 como invitado.", success: true });
  });

  it("never sends the guest token back to the browser", async () => {
    const result = await enrolGuestAction(2026, "Prima Lejana");

    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("passes the name to the DAL without the spaces around it", async () => {
    await enrolGuestAction(2026, "  Prima Lejana  ");

    expect(enrolGuest).toHaveBeenCalledWith(2026, "Prima Lejana");
  });

  it.each(["", "   "])("refuses the empty name %j with the message of the field", async (name) => {
    const result = await enrolGuestAction(2026, name);

    expect(result).toEqual({ message: "El nombre es obligatorio", success: false });
    expect(enrolGuest).not.toHaveBeenCalled();
  });

  it("refuses a name longer than 60 characters with the message of the field", async () => {
    const result = await enrolGuestAction(2026, "a".repeat(61));

    expect(result).toEqual({ message: "Máximo 60 caracteres", success: false });
    expect(enrolGuest).not.toHaveBeenCalled();
  });

  it.each([2026.5, 99999999999, Number.NaN, "2026" as unknown as number])(
    "refuses the year %j in Spanish before reaching the DAL",
    async (year) => {
      const result = await enrolGuestAction(year, "Prima Lejana");

      expect(result).toEqual({ message: "El año no es válido.", success: false });
      expect(enrolGuest).not.toHaveBeenCalled();
    },
  );

  it("shows the message of the name when both the name and the year are wrong", async () => {
    const result = await enrolGuestAction(2026.5, "");

    expect(result).toEqual({ message: "El nombre es obligatorio", success: false });
  });

  it("shows the conflict message from the DAL", async () => {
    vi.mocked(enrolGuest).mockRejectedValue(new ConflictError("Anónimo ya está en la edición 2026 como invitado."));

    const result = await enrolGuestAction(2026, "anónimo");

    expect(result).toEqual({ message: "Anónimo ya está en la edición 2026 como invitado.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
