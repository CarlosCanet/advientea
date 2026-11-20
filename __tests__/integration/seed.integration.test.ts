import { describe, expect, it } from "vitest";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// An edition has as many days as participants, and the seed follows the rule: five people enrolled
// in 2025, each on the day of their turn, and no day row that nobody holds.
const HOLDERS = [
  { dayNumber: 1, guestName: null, username: "Deinos" },
  { dayNumber: 2, guestName: "Anónimo", username: null },
  { dayNumber: 3, guestName: null, username: "Ñita" },
  { dayNumber: 4, guestName: null, username: "Sony" },
  { dayNumber: 5, guestName: null, username: "mikoalilla" },
];

describe("Database seed verification", () => {
  it("should populate the initial required state", async () => {
    const [userCount, participationCount, dayCount, teaCount] = await Promise.all([
      prisma.user.count(),
      prisma.participation.count(),
      prisma.day.count(),
      prisma.tea.count(),
    ]);
    expect(userCount).toBe(5);
    expect(participationCount).toBe(5);
    expect(dayCount).toBe(5);
    expect(teaCount).toBe(2);
  });

  it("should have critical users configured", async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    const executeave = await prisma.user.findFirst({ where: { role: Role.EXECUTEAVE } });
    expect(admin).toBeDefined();
    expect(admin?.email).toBe("admin@example.com");
    expect(executeave).toBeDefined();
    expect(executeave?.email).toBe("gerente@example.com");
  });

  it("should have the five accounts, one admin and one manager", async () => {
    const users = await prisma.user.findMany();

    expect(users.map((user) => user.username).toSorted()).toEqual(
      ["CarlosC", "Deinos", "mikoalilla", "Sony", "Ñita"].toSorted(),
    );
    expect(users.filter((user) => user.role === Role.ADMIN).map((user) => user.username)).toEqual(["CarlosC"]);
    expect(users.filter((user) => user.role === Role.EXECUTEAVE).map((user) => user.username)).toEqual(["Deinos"]);
  });

  it("should make the seeded year the active edition", async () => {
    const edition = await prisma.edition.findUnique({ where: { year: 2025 } });

    expect(edition?.status).toBe(EditionStatus.ACTIVE);
  });

  it("should have five day rows, numbered 1 to 5, and no other in any edition", async () => {
    const days = await prisma.day.findMany({ orderBy: [{ year: "asc" }, { dayNumber: "asc" }] });

    expect(days.map((day) => ({ dayNumber: day.dayNumber, year: day.year }))).toEqual(
      HOLDERS.map(({ dayNumber }) => ({ dayNumber, year: 2025 })),
    );
  });

  it("should have every day held, each by the person whose turn it is", async () => {
    const days = await prisma.day.findMany({
      include: { participation: { include: { user: true } } },
      orderBy: { dayNumber: "asc" },
      where: { year: 2025 },
    });

    expect(days.filter((day) => day.participation === null)).toEqual([]);
    expect(
      days.map((day) => ({
        dayNumber: day.dayNumber,
        guestName: day.participation?.guestName ?? null,
        username: day.participation?.user?.username ?? null,
      })),
    ).toEqual(HOLDERS);
    expect(days.map((day) => day.participation?.year)).toEqual(HOLDERS.map(() => 2025));
  });

  it("should enrol those five and nobody else: the admin is not in the edition", async () => {
    const participations = await prisma.participation.findMany();
    const admin = await prisma.user.findFirstOrThrow({
      include: { participations: true },
      where: { role: Role.ADMIN },
    });

    expect(participations).toHaveLength(HOLDERS.length);
    expect(participations.filter((participation) => participation.dayId === null)).toEqual([]);
    expect(admin.username).toBe("CarlosC");
    expect(admin.participations).toEqual([]);
    expect(participations.map((participation) => participation.userId)).not.toContain(admin.id);
  });

  it("should have the two teas on the participations of the manager and the guest", async () => {
    const teas = await prisma.tea.findMany({
      include: { participation: { include: { day: true, user: true } } },
    });

    expect(
      teas
        .map((tea) => ({
          dayNumber: tea.participation.day?.dayNumber,
          guestName: tea.participation.guestName,
          name: tea.name,
          role: tea.participation.user?.role ?? null,
          username: tea.participation.user?.username ?? null,
        }))
        .toSorted((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0)),
    ).toEqual([
      { dayNumber: 1, guestName: null, name: "Ruta del desierto", role: Role.EXECUTEAVE, username: "Deinos" },
      { dayNumber: 2, guestName: "Anónimo", name: "Pakistaní", role: null, username: null },
    ]);
  });

  it("should give the guest a token", async () => {
    const guests = await prisma.participation.findMany({ where: { guestName: { not: null } } });

    expect(guests).toHaveLength(1);
    expect(guests[0]).toMatchObject({ guestName: "Anónimo", userId: null });
    // Random on every run, so only that it is there.
    expect(guests[0].guestToken).toEqual(expect.any(String));
    expect(guests[0].guestToken).not.toBe("");
  });

  it("should have relationships correctly linked", async () => {
    const day1 = await prisma.day.findUnique({
      include: {
        participation: {
          include: {
            tea: {
              include: {
                story: {
                  include: { images: { orderBy: { order: "asc" } } },
                },
              },
            },
            user: true,
          },
        },
      },
      where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
    });
    const tea = day1?.participation?.tea;
    expect(day1?.participation?.user?.username).toBe("Deinos");
    expect(tea?.name).toBe("Ruta del desierto");
    expect(tea?.story?.storyPart1).toBe("Todo pasó hace tiempo");
    expect(tea?.story?.youtubeURL).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
    expect(tea?.story?.images[0].publicId).toBe("samples/dessert-on-a-plate");
    expect(tea?.story?.images[2].publicId).toBe("samples/cup-on-a-table");
  });
});
