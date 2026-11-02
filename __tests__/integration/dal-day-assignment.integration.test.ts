import { describe, expect, it } from "vitest";

import { assignDay, getDayByDayNumber, unassignDay } from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// The seed gives 2025 an active edition with 25 days: day 1 manager (with tea), day 2 guest "Anónimo"
// (with tea), days 3, 4 and 5 to ana, sony and miko, the rest free.
const beforeTheEdition = new Date("2025-11-15T12:00:00+01:00");
const duringTheEdition = new Date("2025-12-10T12:00:00+01:00");

async function day(dayNumber: number) {
  const found = await getDayByDayNumber({ dayNumber, year: 2025 });
  if (!found) {
    throw new Error(`seed has no day ${dayNumber}`);
  }
  return found;
}

async function userWithoutDay() {
  return prisma.user.findFirstOrThrow({ where: { daysAssigned: { none: {} } } });
}

describe("dal DayAssignment", () => {
  describe("assignDay", () => {
    it("puts a user with no participation on a free day, taking the year from the day", async () => {
      const user = await userWithoutDay();
      const free = await day(6);

      const result = await assignDay(free.id, { userId: user.id }, beforeTheEdition);

      expect(result).toMatchObject({ dayId: free.id, guestName: null, userId: user.id, year: 2025 });
      expect(result.day?.dayNumber).toBe(6);
      expect(result.user?.id).toBe(user.id);
    });

    it("is idempotent for the person already on the day", async () => {
      const three = await day(3);
      const current = await prisma.dayAssignment.findUniqueOrThrow({ where: { dayId: three.id } });

      const result = await assignDay(three.id, { userId: current.userId! }, beforeTheEdition);

      expect(result.id).toBe(current.id);
      expect(await prisma.dayAssignment.count({ where: { year: 2025 } })).toBe(5);
    });

    it("refuses a day held by someone else and names them", async () => {
      const four = await day(4);
      const ana = await prisma.dayAssignment.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });

      await expect(assignDay(four.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(assignDay(four.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(/Sony/);
    });

    it("refuses to move in silence a user who already has another day this year", async () => {
      const ana = await prisma.dayAssignment.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });
      const free = await day(7);

      await expect(assignDay(free.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(/el día 3/);
      expect((await prisma.dayAssignment.findUniqueOrThrow({ where: { id: ana.id } })).dayId).toBe(ana.dayId);
    });

    it("gives the day to a user enrolled without one, reusing their participation", async () => {
      const user = await userWithoutDay();
      const enrolled = await prisma.dayAssignment.create({
        data: { edition: { connect: { year: 2025 } }, user: { connect: { id: user.id } } },
      });
      const free = await day(8);

      const result = await assignDay(free.id, { userId: user.id }, beforeTheEdition);

      expect(result.id).toBe(enrolled.id);
      expect(result.dayId).toBe(free.id);
    });

    it("creates a guest participation on a free day", async () => {
      const free = await day(9);

      const result = await assignDay(free.id, { guestName: "Prima Lejana" }, beforeTheEdition);

      expect(result).toMatchObject({ dayId: free.id, guestName: "Prima Lejana", userId: null, year: 2025 });
    });

    it("still accepts the person already on a day that has opened, since nothing changes", async () => {
      const three = await day(3);
      const current = await prisma.dayAssignment.findUniqueOrThrow({ where: { dayId: three.id } });

      const result = await assignDay(three.id, { userId: current.userId! }, duringTheEdition);

      expect(result.id).toBe(current.id);
    });

    it("refuses a day that has already opened", async () => {
      const user = await userWithoutDay();
      const past = await day(7);

      await expect(assignDay(past.id, { userId: user.id }, duringTheEdition)).rejects.toThrow(/ya ha pasado o es hoy/);
    });

    it("rejects an unknown day as invalid input, not as a conflict", async () => {
      await expect(assignDay("no-such-day", { guestName: "Nadie" }, beforeTheEdition)).rejects.toThrow(
        /does not exist/,
      );
    });
  });

  describe("unassignDay", () => {
    it("frees the day and keeps the person enrolled without one", async () => {
      const three = await day(3);
      const before = await prisma.dayAssignment.findUniqueOrThrow({ where: { dayId: three.id } });

      await unassignDay(three.id, beforeTheEdition);

      const after = await prisma.dayAssignment.findUniqueOrThrow({ where: { id: before.id } });
      expect(after.dayId).toBeNull();
      expect(after.userId).toBe(before.userId);
    });

    it("refuses to free a day that holds a tea", async () => {
      const one = await day(1);

      await expect(unassignDay(one.id, beforeTheEdition)).rejects.toThrow(/tiene un té/);
    });

    it("refuses to free a day that has already opened", async () => {
      const three = await day(3);

      await expect(unassignDay(three.id, duringTheEdition)).rejects.toThrow(ConflictError);
    });

    it("does nothing on a free day", async () => {
      const free = await day(10);

      await expect(unassignDay(free.id, beforeTheEdition)).resolves.toBeUndefined();
    });
  });
});
