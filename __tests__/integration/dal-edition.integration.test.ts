import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import {
  changeEditionStatus,
  createEdition,
  deleteEdition,
  enrolGuest,
  enrolUser,
  getAllEditions,
  getEditionInfo,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

describe("dal Edition", () => {
  // The seed makes 2025 the active edition before every test.
  describe("createEdition", () => {
    it("creates the edition in preparation, with its year and name", async () => {
      const created = await createEdition("Advienté de los cerezos", 2026);

      expect(created).toMatchObject({ name: "Advienté de los cerezos", status: EditionStatus.PREPARING, year: 2026 });
    });

    it("refuses a year that already has an edition", async () => {
      await expect(createEdition("Otra 2025", 2025)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2025 } })).toBe(1);
    });
  });

  describe("changeEditionStatus", () => {
    it("activates an edition in preparation once no other is active", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);
      await createEdition("Advienté 2026", 2026);

      const activated = await changeEditionStatus(2026, EditionStatus.ACTIVE);

      expect(activated.status).toBe(EditionStatus.ACTIVE);
    });

    it("refuses to activate while another edition is active, naming it, and changes nothing", async () => {
      await createEdition("Advienté 2026", 2026);

      await expect(changeEditionStatus(2026, EditionStatus.ACTIVE)).rejects.toThrow(/2025/);
      await expect(changeEditionStatus(2026, EditionStatus.ACTIVE)).rejects.toBeInstanceOf(ConflictError);
      expect((await prisma.edition.findUniqueOrThrow({ where: { year: 2026 } })).status).toBe(EditionStatus.PREPARING);
    });

    it("moves editions backwards too: active to preparation, archived to active", async () => {
      expect((await changeEditionStatus(2025, EditionStatus.PREPARING)).status).toBe(EditionStatus.PREPARING);
      expect((await changeEditionStatus(2025, EditionStatus.ARCHIVED)).status).toBe(EditionStatus.ARCHIVED);
      expect((await changeEditionStatus(2025, EditionStatus.ACTIVE)).status).toBe(EditionStatus.ACTIVE);
    });

    it("archives an edition straight from preparation", async () => {
      await createEdition("Advienté 2026", 2026);

      expect((await changeEditionStatus(2026, EditionStatus.ARCHIVED)).status).toBe(EditionStatus.ARCHIVED);
    });

    it("refuses the status the edition already has, and a year with no edition", async () => {
      await expect(changeEditionStatus(2025, EditionStatus.ACTIVE)).rejects.toBeInstanceOf(ConflictError);
      await expect(changeEditionStatus(2031, EditionStatus.PREPARING)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("deleteEdition", () => {
    it("deletes an empty edition in preparation", async () => {
      await createEdition("Advienté 2026", 2026);

      const deleted = await deleteEdition(2026);

      expect(deleted.year).toBe(2026);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(0);
    });

    it("refuses an empty edition that is active or archived", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);
      await upsertEdition(2026, EditionStatus.ACTIVE);
      await upsertEdition(2027, EditionStatus.ARCHIVED);

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      await expect(deleteEdition(2027)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: { in: [2026, 2027] } } })).toBe(2);
    });

    it("refuses an edition in preparation that already has a day", async () => {
      await createEdition("Advienté 2026", 2026);
      await prisma.day.create({ data: { dayNumber: 1, year: 2026 } });

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(1);
    });

    it("refuses an edition in preparation that already has someone enrolled without a day", async () => {
      await createEdition("Advienté 2026", 2026);
      await prisma.participation.create({ data: { guestName: "Prima Lejana", year: 2026 } });

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(1);
    });

    it("refuses a year with no edition", async () => {
      await expect(deleteEdition(2031)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("getAllEditions", () => {
    it("lists every edition, the newest first", async () => {
      await createEdition("Advienté 2027", 2027);
      await createEdition("Advienté 2026", 2026);

      expect((await getAllEditions()).map((edition) => edition.year)).toEqual([2027, 2026, 2025]);
    });
  });

  describe("getEditionInfo", () => {
    // An edition has one calendar day per person enrolled. Day rows are only storage: the seed gives
    // 2025 twenty-five of them and five participants, so the two numbers never agree by accident.
    async function enrolGuests(year: number, count: number) {
      const guests: Awaited<ReturnType<typeof enrolGuest>>[] = [];
      for (let index = 1; index <= count; index++) {
        guests.push(await enrolGuest(year, `Invitada ${index}`));
      }
      return guests;
    }

    async function addDayRows(year: number, count: number) {
      await prisma.day.createMany({
        data: Array.from({ length: count }, (_, index) => ({ dayNumber: index + 1, year })),
      });
    }

    async function dayRow(year: number, dayNumber: number) {
      return prisma.day.findUniqueOrThrow({ where: { dayNumber_year: { dayNumber, year } } });
    }

    it("is 0 for an edition with nobody enrolled", async () => {
      await createEdition("Advienté 2030", 2030);

      expect(await getEditionInfo(2030)).toEqual({ lastDayNumber: 0, status: EditionStatus.PREPARING, year: 2030 });
    });

    it("stays 0 while the edition only has day rows that nobody holds", async () => {
      await createEdition("Advienté 2030", 2030);
      await addDayRows(2030, 25);

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(0);
    });

    it("counts the participants, not the day rows: 25 rows and 3 participants give 3", async () => {
      await createEdition("Advienté 2030", 2030);
      await addDayRows(2030, 25);
      await enrolGuests(2030, 3);

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(3);
    });

    it("counts 3 participants in an edition without a single day row", async () => {
      await createEdition("Advienté 2030", 2030);
      await enrolGuests(2030, 3);

      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(0);
      expect((await getEditionInfo(2030)).lastDayNumber).toBe(3);
    });

    it("counts accounts and guests alike, with or without a day", async () => {
      await createEdition("Advienté 2030", 2030);
      const [placedUser, waitingUser] = await prisma.user.findMany({ orderBy: { username: "asc" }, take: 2 });
      const placedAccount = await enrolUser(2030, placedUser.id);
      await enrolUser(2030, waitingUser.id);
      const [placedGuest] = await enrolGuests(2030, 2);
      await addDayRows(2030, 2);
      await prisma.participation.update({
        data: { dayId: (await dayRow(2030, 1)).id },
        where: { id: placedAccount.id },
      });
      await prisma.participation.update({
        data: { dayId: (await dayRow(2030, 2)).id },
        where: { id: placedGuest.id },
      });

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(4);
    });

    it("counts someone sitting on a leftover day above the calendar exactly once", async () => {
      await createEdition("Advienté 2030", 2030);
      await addDayRows(2030, 25);
      await enrolGuests(2030, 2);
      await prisma.participation.create({
        data: { dayId: (await dayRow(2030, 20)).id, guestName: "Prima Lejana", year: 2030 },
      });

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(3);
    });

    it("gives the seeded edition its number of participants, far below its day rows", async () => {
      const enrolled = await prisma.participation.count({ where: { year: 2025 } });
      expect(enrolled).toBeGreaterThan(0);
      expect(await prisma.day.count({ where: { year: 2025 } })).toBeGreaterThan(enrolled);

      expect((await getEditionInfo(2025)).lastDayNumber).toBe(enrolled);
    });

    it("leaves out the participants of the other editions", async () => {
      await createEdition("Advienté 2030", 2030);
      await createEdition("Advienté 2031", 2031);
      await enrolGuests(2030, 2);
      await enrolGuests(2031, 4);
      const seeded = await prisma.participation.count({ where: { year: 2025 } });

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(2);
      expect((await getEditionInfo(2031)).lastDayNumber).toBe(4);
      expect((await getEditionInfo(2025)).lastDayNumber).toBe(seeded);
    });

    it("goes up by one with each person enrolled, guest or account", async () => {
      const before = (await getEditionInfo(2025)).lastDayNumber;
      expect(before).toBe(await prisma.participation.count({ where: { year: 2025 } }));

      await enrolGuest(2025, "Prima Lejana");
      expect((await getEditionInfo(2025)).lastDayNumber).toBe(before + 1);

      const newcomer = await prisma.user.findFirstOrThrow({ where: { participations: { none: {} } } });
      await enrolUser(2025, newcomer.id);
      expect((await getEditionInfo(2025)).lastDayNumber).toBe(before + 2);
    });

    it("goes from 0 to 1 with the first person enrolled", async () => {
      await createEdition("Advienté 2030", 2030);
      expect((await getEditionInfo(2030)).lastDayNumber).toBe(0);

      await enrolGuest(2030, "Prima Lejana");

      expect((await getEditionInfo(2030)).lastDayNumber).toBe(1);
    });

    it("returns the status and the year of the edition asked for", async () => {
      await createEdition("Advienté 2030", 2030);
      await upsertEdition(2031, EditionStatus.ARCHIVED);

      expect(await getEditionInfo(2025)).toMatchObject({ status: EditionStatus.ACTIVE, year: 2025 });
      expect(await getEditionInfo(2030)).toMatchObject({ status: EditionStatus.PREPARING, year: 2030 });
      expect(await getEditionInfo(2031)).toMatchObject({ status: EditionStatus.ARCHIVED, year: 2031 });
    });

    it("follows the edition when its status changes", async () => {
      await changeEditionStatus(2025, EditionStatus.ARCHIVED);

      expect((await getEditionInfo(2025)).status).toBe(EditionStatus.ARCHIVED);
    });

    it("rejects an unknown year with a plain error, not a conflict", async () => {
      const error: unknown = await getEditionInfo(2099).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect((error as Error).constructor).toBe(Error);
      expect((error as Error).message).toBe("The edition 2099 does not exist.");
    });
  });

  describe("upsertEdition", () => {
    it("creates the edition once and only updates its status on a second call", async () => {
      const created = await upsertEdition(2030, EditionStatus.PREPARING);
      expect(created).toMatchObject({ name: "Advienté 2030", status: EditionStatus.PREPARING, year: 2030 });

      const again = await upsertEdition(2030, EditionStatus.ACTIVE);
      expect(again.status).toBe(EditionStatus.ACTIVE);
      expect(await prisma.edition.count({ where: { year: 2030 } })).toBe(1);

      await prisma.edition.delete({ where: { year: 2030 } });
    });
  });

  it("refuses to delete an edition that still has days", async () => {
    // The seed creates the 2025 edition with its 25 days before every test.
    await expect(prisma.edition.delete({ where: { year: 2025 } })).rejects.toThrow();
    expect(await prisma.edition.count({ where: { year: 2025 } })).toBe(1);
  });
});
