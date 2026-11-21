import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { getEdition, isParticipationDayPlayed } from "@/lib/dal";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

vi.mock("@/lib/dal", () => ({ getEdition: vi.fn(), isParticipationDayPlayed: vi.fn() }));

function teaOf(userId: null | string, day: null | { dayNumber: number } = { dayNumber: 3 }) {
  return {
    participation: {
      day: day && { ...day, createdAt: new Date(), id: "day-id", updatedAt: new Date(), year: 2026 },
      id: "participation-id",
      userId,
      year: 2026,
    },
  };
}

function editionIs(status: EditionStatus) {
  vi.mocked(getEdition).mockResolvedValue({ status, year: 2026 } as Awaited<ReturnType<typeof getEdition>>);
}

function dayPlayed(played: boolean) {
  vi.mocked(isParticipationDayPlayed).mockResolvedValue(played);
}

describe("userCanEditTea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editionIs(EditionStatus.PREPARING);
    dayPlayed(false);
  });

  it("looks at the edition of the tea's participation", async () => {
    await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana"));

    expect(getEdition).toHaveBeenCalledWith(2026);
  });

  it("asks whether the day of the tea's participation has been played", async () => {
    await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana"));

    expect(isParticipationDayPlayed).toHaveBeenCalledWith("participation-id");
  });

  it("lets a user edit the tea of their own participation", async () => {
    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana"))).toBe(true);
  });

  it("lets a user edit their own tea before they have a day", async () => {
    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana", null))).toBe(true);
  });

  it("refuses a user the tea of someone else, and the tea of a guest", async () => {
    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("sony"))).toBe(false);
    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf(null))).toBe(false);
  });

  it("refuses a user their own tea once the edition is archived", async () => {
    editionIs(EditionStatus.ARCHIVED);

    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana"))).toBe(false);
  });

  it("refuses a user their own tea once its day has been played", async () => {
    editionIs(EditionStatus.ACTIVE);
    dayPlayed(true);

    expect(await userCanEditTea({ id: "ana", role: Role.USER }, teaOf("ana"))).toBe(false);
  });

  it("lets the manager edit any tea of an edition that is not archived", async () => {
    expect(await userCanEditTea({ id: "boss", role: Role.EXECUTEAVE }, teaOf("ana"))).toBe(true);
    expect(await userCanEditTea({ id: "boss", role: Role.EXECUTEAVE }, teaOf(null))).toBe(true);
  });

  it("lets the manager and the admin edit a tea whose day has been played", async () => {
    editionIs(EditionStatus.ACTIVE);
    dayPlayed(true);

    expect(await userCanEditTea({ id: "boss", role: Role.EXECUTEAVE }, teaOf("ana"))).toBe(true);
    expect(await userCanEditTea({ id: "root", role: Role.ADMIN }, teaOf("ana"))).toBe(true);
  });

  it("refuses when the edition of the tea does not exist", async () => {
    vi.mocked(getEdition).mockResolvedValue(null);

    expect(await userCanEditTea({ id: "boss", role: Role.EXECUTEAVE }, teaOf("ana"))).toBe(false);
  });
});
