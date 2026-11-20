import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changeEditionStatusAction,
  deleteDayAction,
  enrolGuestAction,
  enrolUserAction,
  placeParticipantAction,
  swapParticipantsAction,
  unenrolParticipantAction,
} from "@/app/actions/editionActions";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { deleteAsset } from "@/lib/cloudinary";
import {
  changeEditionStatus,
  createEdition,
  deleteDay,
  deleteEdition,
  enrolGuest,
  enrolUser,
  placeParticipant,
  requireRole,
  swapParticipants,
  unenrolParticipant,
  unplaceParticipant,
} from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";

vi.mock("@/lib/dal", () => ({
  changeEditionStatus: vi.fn(),
  createEdition: vi.fn(),
  deleteDay: vi.fn(),
  deleteEdition: vi.fn(),
  enrolGuest: vi.fn(),
  enrolUser: vi.fn(),
  placeParticipant: vi.fn(),
  requireRole: vi.fn(),
  swapParticipants: vi.fn(),
  unenrolParticipant: vi.fn(),
  unplaceParticipant: vi.fn(),
}));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type PlacedParticipation = Awaited<ReturnType<typeof placeParticipant>>;

/** A participation as the DAL returns it, with only what the actions read to word their answer. */
function participation(who: { guestName?: string; username?: string }, dayNumber: null | number, year = 2026) {
  return {
    day: dayNumber === null ? null : { dayNumber, year },
    guestName: who.guestName ?? null,
    user: who.username === undefined ? null : { username: who.username },
    year,
  } as PlacedParticipation;
}

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

describe("placeParticipantAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(placeParticipant).mockResolvedValue(participation({ username: "Ana" }, 5));
    vi.mocked(unplaceParticipant).mockResolvedValue(participation({ username: "Ana" }, null));
  });

  it("is open to the admin and to the calendar manager", async () => {
    await placeParticipantAction("participation-id", 5);

    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN, Role.EXECUTEAVE);
  });

  it.each([
    { error: new UnauthenticatedError(), visitor: "someone without a session" },
    { error: new ForbiddenError(), visitor: "someone without the role" },
  ])("answers $visitor with the message of the refusal and never reaches the DAL", async ({ error }) => {
    vi.mocked(requireRole).mockRejectedValue(error);

    const placing = await placeParticipantAction("participation-id", 5);
    const unplacing = await placeParticipantAction("participation-id", null);

    expect(placing).toEqual({ message: error.message, success: false });
    expect(unplacing).toEqual({ message: error.message, success: false });
    expect(placeParticipant).not.toHaveBeenCalled();
    expect(unplaceParticipant).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("places the person on the day, says so and refreshes the page of their edition", async () => {
    const result = await placeParticipantAction("participation-id", 5);

    expect(placeParticipant).toHaveBeenCalledTimes(1);
    expect(placeParticipant).toHaveBeenCalledWith("participation-id", 5);
    expect(unplaceParticipant).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(result).toEqual({ message: "Ana tiene ahora el día 5.", success: true });
  });

  it("leaves the person without a day when the day is null, says so and refreshes the page", async () => {
    const result = await placeParticipantAction("participation-id", null);

    expect(unplaceParticipant).toHaveBeenCalledTimes(1);
    expect(unplaceParticipant).toHaveBeenCalledWith("participation-id");
    expect(placeParticipant).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(result).toEqual({ message: "Ana se queda sin día.", success: true });
  });

  it("refreshes the page of the edition the participation belongs to", async () => {
    vi.mocked(placeParticipant).mockResolvedValue(participation({ username: "Ana" }, 5, 2031));
    vi.mocked(unplaceParticipant).mockResolvedValue(participation({ username: "Ana" }, null, 2032));

    await placeParticipantAction("participation-id", 5);
    await placeParticipantAction("participation-id", null);

    expect(revalidatePath).toHaveBeenNthCalledWith(1, "/editions/2031");
    expect(revalidatePath).toHaveBeenNthCalledWith(2, "/editions/2032");
  });

  it("names a guest by the guest name", async () => {
    vi.mocked(placeParticipant).mockResolvedValue(participation({ guestName: "Prima Lejana" }, 3));
    vi.mocked(unplaceParticipant).mockResolvedValue(participation({ guestName: "Prima Lejana" }, null));

    const placing = await placeParticipantAction("participation-id", 3);
    const unplacing = await placeParticipantAction("participation-id", null);

    expect(placing).toEqual({ message: "Prima Lejana tiene ahora el día 3.", success: true });
    expect(unplacing).toEqual({ message: "Prima Lejana se queda sin día.", success: true });
  });

  it("names someone whose account was deleted without a name", async () => {
    vi.mocked(placeParticipant).mockResolvedValue(participation({}, 3));
    vi.mocked(unplaceParticipant).mockResolvedValue(participation({}, null));

    const placing = await placeParticipantAction("participation-id", 3);
    const unplacing = await placeParticipantAction("participation-id", null);

    expect(placing).toEqual({ message: "Esa persona tiene ahora el día 3.", success: true });
    expect(unplacing).toEqual({ message: "Esa persona se queda sin día.", success: true });
  });

  it.each([
    { dayNumber: 5, participationId: "" },
    { dayNumber: 5, participationId: 7 },
    { dayNumber: 5, participationId: undefined },
    { dayNumber: null, participationId: "" },
    { dayNumber: 0, participationId: "participation-id" },
    { dayNumber: -1, participationId: "participation-id" },
    { dayNumber: 2.5, participationId: "participation-id" },
    { dayNumber: Number.NaN, participationId: "participation-id" },
    { dayNumber: "3", participationId: "participation-id" },
    { dayNumber: undefined, participationId: "participation-id" },
  ])("refuses the participation $participationId with the day $dayNumber before reaching the DAL", async (input) => {
    const result = await placeParticipantAction(input.participationId as string, input.dayNumber as null | number);

    expect(result).toEqual({ message: "La inscripción o el día no son válidos.", success: false });
    expect(placeParticipant).not.toHaveBeenCalled();
    expect(unplaceParticipant).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL when placing", async () => {
    vi.mocked(placeParticipant).mockRejectedValue(new ConflictError("El día 5 es de Sony."));

    const result = await placeParticipantAction("participation-id", 5);

    expect(result).toEqual({ message: "El día 5 es de Sony.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL when leaving without a day", async () => {
    vi.mocked(unplaceParticipant).mockRejectedValue(
      new ConflictError("Ese día ya ha pasado o es hoy y no se puede cambiar."),
    );

    const result = await placeParticipantAction("participation-id", null);

    expect(result).toEqual({ message: "Ese día ya ha pasado o es hoy y no se puede cambiar.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hides an unexpected error behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(placeParticipant).mockRejectedValue(new Error("connection refused"));
    vi.mocked(unplaceParticipant).mockRejectedValue(new Error("too many clients already"));

    const placing = await placeParticipantAction("participation-id", 5);
    const unplacing = await placeParticipantAction("participation-id", null);

    expect(placing).toEqual({ message: "No se pudo cambiar el día. Inténtalo de nuevo.", success: false });
    expect(unplacing).toEqual({ message: "No se pudo cambiar el día. Inténtalo de nuevo.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("swapParticipantsAction", () => {
  const swapped = (...pair: [PlacedParticipation, PlacedParticipation]) =>
    pair as Awaited<ReturnType<typeof swapParticipants>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({ username: "Ana" }, 5), participation({ guestName: "Prima Lejana" }, 3)),
    );
  });

  it("is open to the admin and to the calendar manager", async () => {
    await swapParticipantsAction("first-id", "second-id");

    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN, Role.EXECUTEAVE);
  });

  it.each([
    { error: new UnauthenticatedError(), visitor: "someone without a session" },
    { error: new ForbiddenError(), visitor: "someone without the role" },
  ])("answers $visitor with the message of the refusal and never reaches the DAL", async ({ error }) => {
    vi.mocked(requireRole).mockRejectedValue(error);

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: error.message, success: false });
    expect(swapParticipants).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("swaps the two, says where each one ends in argument order and refreshes the page of the edition", async () => {
    const result = await swapParticipantsAction("first-id", "second-id");

    expect(swapParticipants).toHaveBeenCalledTimes(1);
    expect(swapParticipants).toHaveBeenCalledWith("first-id", "second-id");
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(result).toEqual({ message: "Ana pasa al día 5 y Prima Lejana pasa al día 3.", success: true });
  });

  it("refreshes the page of the edition the participations belong to", async () => {
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({ username: "Ana" }, 5, 2031), participation({ guestName: "Prima Lejana" }, 3, 2031)),
    );

    await swapParticipantsAction("first-id", "second-id");

    expect(revalidatePath).toHaveBeenCalledWith("/editions/2031");
  });

  it("says that the first one is left without a day when the day passed to the second", async () => {
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({ username: "Ana" }, null), participation({ guestName: "Prima Lejana" }, 3)),
    );

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: "Ana se queda sin día y Prima Lejana pasa al día 3.", success: true });
  });

  it("says that the second one is left without a day when the day passed to the first", async () => {
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({ username: "Ana" }, 5), participation({ guestName: "Prima Lejana" }, null)),
    );

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: "Ana pasa al día 5 y Prima Lejana se queda sin día.", success: true });
  });

  it("says that both are left without a day when neither had one", async () => {
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({ username: "Ana" }, null), participation({ guestName: "Prima Lejana" }, null)),
    );

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: "Ana se queda sin día y Prima Lejana se queda sin día.", success: true });
  });

  it("names someone whose account was deleted without a name", async () => {
    vi.mocked(swapParticipants).mockResolvedValue(
      swapped(participation({}, 5), participation({ username: "Sony" }, null)),
    );

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: "Esa persona pasa al día 5 y Sony se queda sin día.", success: true });
  });

  it.each([
    { first: "", second: "second-id" },
    { first: "first-id", second: "" },
    { first: "same-id", second: "same-id" },
    { first: 7, second: "second-id" },
    { first: "first-id", second: undefined },
  ])("refuses the participations $first and $second before reaching the DAL", async ({ first, second }) => {
    const result = await swapParticipantsAction(first as string, second as string);

    expect(result).toEqual({ message: "Las inscripciones no son válidas.", success: false });
    expect(swapParticipants).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL", async () => {
    vi.mocked(swapParticipants).mockRejectedValue(
      new ConflictError("Los días acaban de cambiar. Recarga la página y vuelve a intentarlo."),
    );

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({
      message: "Los días acaban de cambiar. Recarga la página y vuelve a intentarlo.",
      success: false,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hides an unexpected error behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(swapParticipants).mockRejectedValue(new Error("The participations belong to different editions."));

    const result = await swapParticipantsAction("first-id", "second-id");

    expect(result).toEqual({ message: "No se pudo intercambiar. Inténtalo de nuevo.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteDayAction", () => {
  type DeletedDay = Awaited<ReturnType<typeof deleteDay>>;

  const deletedDay = (dayNumber: number, year: number): DeletedDay => ({
    createdAt: new Date("2026-11-01T12:00:00+01:00"),
    dayNumber,
    id: "day-id",
    updatedAt: new Date("2026-11-01T12:00:00+01:00"),
    year,
  });

  const OTHER_DAL_FUNCTIONS = {
    changeEditionStatus,
    createEdition,
    deleteEdition,
    enrolGuest,
    enrolUser,
    placeParticipant,
    swapParticipants,
    unenrolParticipant,
    unplaceParticipant,
  };

  function expectNothingElseFromTheDal() {
    for (const [name, dalFunction] of Object.entries(OTHER_DAL_FUNCTIONS)) {
      expect(dalFunction, `deleteDayAction reached dal.${name}`).not.toHaveBeenCalled();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(deleteDay).mockResolvedValue(deletedDay(7, 2026));
  });

  it("is open to the admin only, not to the calendar manager", async () => {
    await deleteDayAction("day-id");

    expect(requireRole).toHaveBeenCalledTimes(1);
    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN);
  });

  it.each([
    { error: new UnauthenticatedError(), visitor: "someone without a session" },
    { error: new ForbiddenError(), visitor: "someone without the role" },
  ])("answers $visitor with the message of the refusal and never reaches the DAL", async ({ error }) => {
    vi.mocked(requireRole).mockRejectedValue(error);

    const result = await deleteDayAction("day-id");

    expect(result).toEqual({ message: error.message, success: false });
    expect(deleteDay).not.toHaveBeenCalled();
    expectNothingElseFromTheDal();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("asks for the role before looking at the day: a refusal wins over a day that is not valid", async () => {
    const refusal = new ForbiddenError();
    vi.mocked(requireRole).mockRejectedValue(refusal);

    const result = await deleteDayAction("");

    expect(result).toEqual({ message: refusal.message, success: false });
    expect(deleteDay).not.toHaveBeenCalled();
  });

  it("answers without throwing when the role check fails for another reason, and never reaches the DAL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(requireRole).mockRejectedValue(new Error("connection refused"));

    const result = await deleteDayAction("day-id");

    expect(result.success).toBe(false);
    expect(result.message).not.toContain("connection refused");
    expect(deleteDay).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the day, says which one and refreshes the page of its edition and nothing else", async () => {
    const result = await deleteDayAction("day-id");

    expect(deleteDay).toHaveBeenCalledTimes(1);
    expect(deleteDay).toHaveBeenCalledWith("day-id");
    expectNothingElseFromTheDal();
    expect(result).toEqual({ message: "Día 7 borrado.", success: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(revalidatePath).not.toHaveBeenCalledWith("/edit-tea-info");
  });

  it("takes the number and the edition from the day the DAL returns", async () => {
    vi.mocked(deleteDay).mockResolvedValue(deletedDay(12, 2031));

    const result = await deleteDayAction("day-id");

    expect(result).toEqual({ message: "Día 12 borrado.", success: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2031");
    expect(revalidatePath).not.toHaveBeenCalledWith("/editions/2026");
    expect(revalidatePath).not.toHaveBeenCalledWith("/edit-tea-info");
  });

  it.each([{ dayId: "" }, { dayId: 7 }, { dayId: undefined }, { dayId: null }, { dayId: { id: "day-id" } }])(
    "refuses the day $dayId before reaching the DAL",
    async ({ dayId }) => {
      const result = await deleteDayAction(dayId as string);

      expect(result).toEqual({ message: "El día no es válido.", success: false });
      expect(deleteDay).not.toHaveBeenCalled();
      expectNothingElseFromTheDal();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each(["Ese día ya no existe.", "El día 7 es de Sony. Quítale el día antes de borrarlo."])(
    "shows the conflict message from the DAL as it is: %s",
    async (message) => {
      vi.mocked(deleteDay).mockRejectedValue(new ConflictError(message));

      const result = await deleteDayAction("day-id");

      expect(result).toEqual({ message, success: false });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("hides an unexpected error behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(deleteDay).mockRejectedValue(new Error("connection refused"));

    const result = await deleteDayAction("day-id");

    expect(result).toEqual({ message: "No se pudo borrar el día. Inténtalo de nuevo.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("unenrolParticipantAction", () => {
  type Unenrolment = Awaited<ReturnType<typeof unenrolParticipant>>;

  /** What the DAL returns once the participation is gone, with only what the action reads to word its answer. */
  type HolderOutside = { dayNumber: number; name: null | string };

  function unenrolment(
    who: { guestName?: string; username?: string },
    had: {
      holdersOutsideCalendar?: HolderOutside[];
      lastDayNumber?: number;
      storyImagePublicIds?: string[];
      teaName?: string;
      year?: number;
    } = {},
  ) {
    return {
      holdersOutsideCalendar: had.holdersOutsideCalendar ?? [],
      lastDayNumber: had.lastDayNumber ?? 24,
      participation: {
        ...participation(who, null, had.year),
        tea: had.teaName === undefined ? null : { id: "tea-id", name: had.teaName },
      },
      storyImagePublicIds: had.storyImagePublicIds ?? [],
    } as unknown as Unenrolment;
  }

  const OTHER_DAL_FUNCTIONS = {
    changeEditionStatus,
    createEdition,
    deleteDay,
    deleteEdition,
    enrolGuest,
    enrolUser,
    placeParticipant,
    swapParticipants,
    unplaceParticipant,
  };

  function expectNothingElseFromTheDal() {
    for (const [name, dalFunction] of Object.entries(OTHER_DAL_FUNCTIONS)) {
      expect(dalFunction, `unenrolParticipantAction reached dal.${name}`).not.toHaveBeenCalled();
    }
  }

  function expectNothingDone() {
    expect(unenrolParticipant).not.toHaveBeenCalled();
    expectNothingElseFromTheDal();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
    vi.mocked(unenrolParticipant).mockResolvedValue(unenrolment({ username: "Ana" }));
    vi.mocked(deleteAsset).mockResolvedValue(undefined as never);
  });

  it("is open to the admin and to the calendar manager, and to nobody else", async () => {
    await unenrolParticipantAction("participation-id", false);

    expect(requireRole).toHaveBeenCalledTimes(1);
    expect(requireRole).toHaveBeenCalledWith(Role.ADMIN, Role.EXECUTEAVE);
  });

  it.each([
    { error: new UnauthenticatedError(), visitor: "someone without a session" },
    { error: new ForbiddenError(), visitor: "someone without the role" },
  ])("answers $visitor with the message of the refusal and never reaches the DAL", async ({ error }) => {
    vi.mocked(requireRole).mockRejectedValue(error);

    const keeping = await unenrolParticipantAction("participation-id", false);
    const deleting = await unenrolParticipantAction("participation-id", true);

    expect(keeping).toEqual({ message: error.message, success: false });
    expect(deleting).toEqual({ message: error.message, success: false });
    expectNothingDone();
  });

  it("asks for the role before looking at its input: a refusal wins over an input that is not valid", async () => {
    const refusal = new ForbiddenError();
    vi.mocked(requireRole).mockRejectedValue(refusal);

    const result = await unenrolParticipantAction("", "true" as unknown as boolean);

    expect(result).toEqual({ message: refusal.message, success: false });
    expectNothingDone();
  });

  it("asks for the role before it reaches the DAL", async () => {
    await unenrolParticipantAction("participation-id", false);

    expect(vi.mocked(requireRole).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(unenrolParticipant).mock.invocationCallOrder[0],
    );
  });

  it.each([
    { deleteTea: false, participationId: "" },
    { deleteTea: true, participationId: "" },
    { deleteTea: false, participationId: 7 },
    { deleteTea: false, participationId: undefined },
    { deleteTea: false, participationId: null },
    { deleteTea: "true", participationId: "participation-id" },
    { deleteTea: "false", participationId: "participation-id" },
    { deleteTea: 1, participationId: "participation-id" },
    { deleteTea: undefined, participationId: "participation-id" },
    { deleteTea: null, participationId: "participation-id" },
  ])(
    "refuses the participation $participationId with $deleteTea about the tea before reaching the DAL",
    async (input) => {
      const result = await unenrolParticipantAction(input.participationId as string, input.deleteTea as boolean);

      expect(result).toEqual({ message: "La inscripción no es válida.", success: false });
      expectNothingDone();
    },
  );

  it.each([false, true])(
    "passes the participation and deleteTea=%j to the DAL, and nothing else",
    async (deleteTea) => {
      await unenrolParticipantAction("participation-id", deleteTea);

      expect(unenrolParticipant).toHaveBeenCalledTimes(1);
      expect(unenrolParticipant).toHaveBeenCalledWith("participation-id", { deleteTea });
      expectNothingElseFromTheDal();
    },
  );

  it("removes someone without a tea, says so and refreshes the page of their edition and nothing else", async () => {
    const result = await unenrolParticipantAction("participation-id", false);

    expect(result).toEqual({ message: "Ana ya no está en la edición 2026.", success: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("says that the tea went with them when the participation had one, and names the tea", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(unenrolment({ username: "Ana" }, { teaName: "Ruta del desierto" }));

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result).toEqual({
      message: "Ana ya no está en la edición 2026 y su té «Ruta del desierto» se ha borrado.",
      success: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
  });

  it("words the answer from what the DAL deleted, not from what was asked about the tea", async () => {
    const asked = await unenrolParticipantAction("participation-id", true);
    vi.mocked(unenrolParticipant).mockResolvedValue(unenrolment({ username: "Ana" }, { teaName: "Pakistaní" }));
    const found = await unenrolParticipantAction("participation-id", true);

    expect(asked).toEqual({ message: "Ana ya no está en la edición 2026.", success: true });
    expect(found).toEqual({
      message: "Ana ya no está en la edición 2026 y su té «Pakistaní» se ha borrado.",
      success: true,
    });
  });

  it("names a guest by the guest name", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(unenrolment({ guestName: "Prima Lejana" }));
    const withoutTea = await unenrolParticipantAction("participation-id", false);
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(
      unenrolment({ guestName: "Prima Lejana" }, { teaName: "Pakistaní" }),
    );
    const withTea = await unenrolParticipantAction("participation-id", true);

    expect(withoutTea).toEqual({ message: "Prima Lejana ya no está en la edición 2026.", success: true });
    expect(withTea).toEqual({
      message: "Prima Lejana ya no está en la edición 2026 y su té «Pakistaní» se ha borrado.",
      success: true,
    });
  });

  it("names someone whose account was deleted without a name", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(unenrolment({}));
    const withoutTea = await unenrolParticipantAction("participation-id", false);
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(unenrolment({}, { teaName: "Pakistaní" }));
    const withTea = await unenrolParticipantAction("participation-id", true);

    expect(withoutTea).toEqual({ message: "Esa persona ya no está en la edición 2026.", success: true });
    expect(withTea).toEqual({
      message: "Esa persona ya no está en la edición 2026 y su té «Pakistaní» se ha borrado.",
      success: true,
    });
  });

  it("takes the edition from the participation the DAL deleted, for the message and for the page", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(unenrolment({ username: "Ana" }, { year: 2031 }));

    const result = await unenrolParticipantAction("participation-id", false);

    expect(result).toEqual({ message: "Ana ya no está en la edición 2031.", success: true });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2031");
    expect(revalidatePath).not.toHaveBeenCalledWith("/editions/2026");
  });

  it("says where the calendar ends now and who is left outside when one holder is", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment(
        { username: "Ana" },
        { holdersOutsideCalendar: [{ dayNumber: 25, name: "Luis" }], lastDayNumber: 24 },
      ),
    );

    const result = await unenrolParticipantAction("participation-id", false);

    expect(result).toEqual({
      message:
        "Ana ya no está en la edición 2026. El calendario acaba ahora en el día 24: Luis (día 25) se queda fuera.",
      success: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
  });

  it("puts the calendar after the tea, with two holders outside joined by 'y' and a deleted account among them", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment(
        { username: "Ana" },
        {
          holdersOutsideCalendar: [
            { dayNumber: 4, name: "Luis" },
            { dayNumber: 5, name: null },
          ],
          lastDayNumber: 3,
          teaName: "Earl Grey",
        },
      ),
    );

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result).toEqual({
      message:
        "Ana ya no está en la edición 2026 y su té «Earl Grey» se ha borrado. El calendario acaba ahora en el día 3: Luis (día 4) y una cuenta borrada (día 5) se quedan fuera.",
      success: true,
    });
  });

  it("lists three or more holders with commas and 'y' before the last, in the order the DAL gave them", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment(
        { guestName: "Prima Lejana" },
        {
          holdersOutsideCalendar: [
            { dayNumber: 5, name: "Zoe" },
            { dayNumber: 6, name: "Berta" },
            { dayNumber: 7, name: "Ana" },
          ],
          lastDayNumber: 4,
        },
      ),
    );
    const three = await unenrolParticipantAction("participation-id", false);
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment(
        { guestName: "Prima Lejana" },
        {
          holdersOutsideCalendar: [
            { dayNumber: 12, name: "Zoe" },
            { dayNumber: 9, name: null },
            { dayNumber: 30, name: "Berta" },
            { dayNumber: 10, name: "Ana" },
          ],
          lastDayNumber: 8,
        },
      ),
    );
    const four = await unenrolParticipantAction("participation-id", false);

    expect(three).toEqual({
      message:
        "Prima Lejana ya no está en la edición 2026. El calendario acaba ahora en el día 4: Zoe (día 5), Berta (día 6) y Ana (día 7) se quedan fuera.",
      success: true,
    });
    expect(four).toEqual({
      message:
        "Prima Lejana ya no está en la edición 2026. El calendario acaba ahora en el día 8: Zoe (día 12), una cuenta borrada (día 9), Berta (día 30) y Ana (día 10) se quedan fuera.",
      success: true,
    });
  });

  it("speaks of one holder in the singular when it is a deleted account", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment({}, { holdersOutsideCalendar: [{ dayNumber: 6, name: null }], lastDayNumber: 5, year: 2031 }),
    );

    const result = await unenrolParticipantAction("participation-id", false);

    expect(result).toEqual({
      message:
        "Esa persona ya no está en la edición 2031. El calendario acaba ahora en el día 5: una cuenta borrada (día 6) se queda fuera.",
      success: true,
    });
  });

  it("says nothing about the calendar when nobody is left outside, whatever its last day is", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(unenrolment({ username: "Ana" }, { lastDayNumber: 0 }));
    const lastOne = await unenrolParticipantAction("participation-id", false);
    vi.mocked(unenrolParticipant).mockResolvedValueOnce(
      unenrolment({ username: "Ana" }, { lastDayNumber: 7, teaName: "Earl Grey" }),
    );
    const withTea = await unenrolParticipantAction("participation-id", true);

    expect(lastOne).toEqual({ message: "Ana ya no está en la edición 2026.", success: true });
    expect(withTea).toEqual({
      message: "Ana ya no está en la edición 2026 y su té «Earl Grey» se ha borrado.",
      success: true,
    });
  });

  it("deletes from Cloudinary each image of the story that went with the tea, once each", async () => {
    const storyImagePublicIds = ["advientea-local/2026/teaDay/one", "advientea-local/2026/teaDay/two", "samples/three"];
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment({ username: "Ana" }, { storyImagePublicIds, teaName: "Ruta del desierto" }),
    );

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result.success).toBe(true);
    expect(deleteAsset).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(deleteAsset)
        .mock.calls.map(([publicId]) => publicId)
        .toSorted(),
    ).toEqual(storyImagePublicIds.toSorted());
    for (const publicId of storyImagePublicIds) {
      expect(deleteAsset).toHaveBeenCalledWith(publicId);
    }
  });

  it("deletes the participation first, then refreshes the page, then deletes the images", async () => {
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment({ username: "Ana" }, { storyImagePublicIds: ["samples/one", "samples/two"], teaName: "Pakistaní" }),
    );

    await unenrolParticipantAction("participation-id", true);

    const [unenrolled] = vi.mocked(unenrolParticipant).mock.invocationCallOrder;
    const [revalidated] = vi.mocked(revalidatePath).mock.invocationCallOrder;
    const assetsDeleted = vi.mocked(deleteAsset).mock.invocationCallOrder;
    expect(assetsDeleted).toHaveLength(2);
    expect(unenrolled).toBeLessThan(revalidated);
    expect(revalidated).toBeLessThan(Math.min(...assetsDeleted));
  });

  it("answers the same when Cloudinary fails to delete an image, and still tries the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment(
        { username: "Ana" },
        { storyImagePublicIds: ["samples/one", "samples/two", "samples/three"], teaName: "Ruta del desierto" },
      ),
    );
    vi.mocked(deleteAsset).mockRejectedValueOnce(new Error("cloudinary is down"));

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result).toEqual({
      message: "Ana ya no está en la edición 2026 y su té «Ruta del desierto» se ha borrado.",
      success: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
    expect(deleteAsset).toHaveBeenCalledTimes(3);
    for (const publicId of ["samples/one", "samples/two", "samples/three"]) {
      expect(deleteAsset).toHaveBeenCalledWith(publicId);
    }
  });

  it("answers the same when Cloudinary fails to delete every image", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(unenrolParticipant).mockResolvedValue(
      unenrolment({ username: "Ana" }, { storyImagePublicIds: ["samples/one", "samples/two"], teaName: "Pakistaní" }),
    );
    vi.mocked(deleteAsset).mockRejectedValue(new Error("cloudinary is down"));

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result).toEqual({
      message: "Ana ya no está en la edición 2026 y su té «Pakistaní» se ha borrado.",
      success: true,
    });
    expect(JSON.stringify(result)).not.toContain("cloudinary is down");
  });

  it.each([
    "Esa inscripción ya no existe.",
    "La edición 2026 está archivada.",
    "Ana tiene el día 3, que ya ha pasado o es hoy: su inscripción no se puede quitar.",
    "Ana tiene el día 3, que ya tiene apuestas: su inscripción no se puede quitar.",
    "Ana ya ha subido su té. Recarga la página y vuelve a intentarlo.",
    "Esa inscripción acaba de cambiar. Recarga la página y vuelve a intentarlo.",
  ])("shows the conflict message from the DAL as it is: %s", async (message) => {
    vi.mocked(unenrolParticipant).mockRejectedValue(new ConflictError(message));

    const result = await unenrolParticipantAction("participation-id", false);

    expect(result).toEqual({ message, success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("hides an unexpected error behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(unenrolParticipant).mockRejectedValue(new Error("connection refused"));

    const result = await unenrolParticipantAction("participation-id", true);

    expect(result).toEqual({ message: "No se pudo quitar la inscripción. Inténtalo de nuevo.", success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });
});
