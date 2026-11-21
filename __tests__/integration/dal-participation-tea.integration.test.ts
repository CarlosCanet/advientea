import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { EditionStatus, TeaType } from "@/generated/prisma/enums";
import {
  addStoryTea,
  addTea,
  enrolGuest,
  enrolUser,
  getOpenParticipationByUserId,
  isParticipationDayPlayed,
  type ParticipationTeaInput,
  replaceStoryImages,
  saveParticipationTea,
  unenrolParticipant,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// The seed gives 2025 an active edition with five participants, each on a day: day 1 manager "Deinos" (tea
// "Ruta del desierto", ROOIBOS, two ingredients, a story with three images), day 2 guest "Anónimo" (tea
// "Pakistaní", a story with one image), days 3, 4 and 5 to "Ñita", "Sony" and "mikoalilla", without a tea.
// The admin "CarlosC" is enrolled nowhere.
const beforeTheEdition = new Date("2025-11-15T12:00:00+01:00");
const duringTheEdition = new Date("2025-12-10T12:00:00+01:00");

const NO_LONGER_ENROLLED = "Esa inscripción ya no existe.";
const editionArchived = (year: number) => `La edición ${year} está archivada y sus tés ya no se pueden cambiar.`;
const DAY_PLAYED = "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.";

// What a USER asks for, what a calendar manager asks for, and what an admin asks for.
const REFUSE_PLAYED = { refuseArchivedEdition: true, refusePlayedDay: true };
const ALLOW_PLAYED = { refuseArchivedEdition: true, refusePlayedDay: false };
const ALLOW_ALL = { refuseArchivedEdition: false, refusePlayedDay: false };

// Who wins a race is a matter of timing, so each one is run a few times, with someone new every time.
const ROUNDS = 5;

const fullContent: ParticipationTeaInput["content"] = {
  addMilk: true,
  canReinfuse: true,
  hasTheine: true,
  infusionTime: 4,
  moreIndications: "Sin azúcar",
  name: "Té de la casa",
  reinfuseNumber: 2,
  storeName: "La tetera azul",
  temperature: 85,
  url: "https://www.example.com/te-de-la-casa",
};

const bareContent: ParticipationTeaInput["content"] = {
  addMilk: false,
  canReinfuse: false,
  hasTheine: false,
  infusionTime: 3,
  name: "Té sin más",
  temperature: 90,
};

const noStory: ParticipationTeaInput["story"] = { onlyMusic: false };

const fullStory: ParticipationTeaInput["story"] = {
  onlyMusic: false,
  storyPart1: "Érase una vez",
  storyPart2: "un té",
  storyPart3: "que nadie adivinó",
  youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
};

function teaInput(overrides: Partial<ParticipationTeaInput> = {}): ParticipationTeaInput {
  return { content: fullContent, images: [], story: noStory, ...overrides };
}

async function userNamed(username: string) {
  return prisma.user.findFirstOrThrow({ where: { username } });
}

async function participationOn(dayNumber: number, year = 2025) {
  return prisma.participation.findFirstOrThrow({ where: { day: { dayNumber, year } } });
}

async function setEditionStatus(status: EditionStatus, year = 2025) {
  await prisma.edition.update({ data: { status }, where: { year } });
}

// A guess hangs from the day row, not from whoever holds it.
async function addGuess(dayNumber: number, year = 2025) {
  const guesser = await prisma.user.findFirstOrThrow();
  const row = await prisma.day.upsert({
    create: { dayNumber, year },
    update: {},
    where: { dayNumber_year: { dayNumber, year } },
  });
  return prisma.teaGuess.create({ data: { dayId: row.id, userId: guesser.id } });
}

// Straight to the rows: enrolling through the DAL refuses archived editions, and these tests need people there.
async function participationIn(year: number, status: EditionStatus, userId: string, dayNumber?: number) {
  await upsertEdition(year, status);
  const day = dayNumber === undefined ? null : await prisma.day.create({ data: { dayNumber, year } });
  return prisma.participation.create({ data: { dayId: day?.id ?? null, userId, year } });
}

async function teaWithStoryOf(participationId: string) {
  return prisma.tea.findUnique({
    include: {
      ingredients: { orderBy: { id: "asc" } },
      story: { include: { images: { orderBy: { order: "asc" } } } },
    },
    where: { participationId },
  });
}

/** Every row a save could reach, whole: what a refusal must leave as it was. */
async function everything() {
  const [days, guesses, images, participations, stories, teas] = await Promise.all([
    prisma.day.findMany({ orderBy: { id: "asc" } }),
    prisma.teaGuess.findMany({ orderBy: { id: "asc" } }),
    prisma.storyImage.findMany({ orderBy: { id: "asc" } }),
    prisma.participation.findMany({ orderBy: { id: "asc" } }),
    prisma.storyTea.findMany({ orderBy: { id: "asc" } }),
    prisma.tea.findMany({ include: { ingredients: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } }),
  ]);
  return { days, guesses, images, participations, stories, teas };
}

async function expectConflict(call: Promise<unknown>, message: string) {
  const error: unknown = await call.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ConflictError);
  expect((error as ConflictError).message).toBe(message);
}

/** Makes the next transaction fail the way Prisma does when a concurrent request changes the rows under it. */
function failNextTransaction(code: string) {
  const error = new Prisma.PrismaClientKnownRequestError("simulated race", { clientVersion: "test", code });
  return vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(error);
}

describe("dal participation tea", () => {
  // A simulated failure that the call never reaches would otherwise break the reset of the next test.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getOpenParticipationByUserId", () => {
    it("returns the participation of the user in the active edition, with its day and its edition", async () => {
      const ana = await userNamed("Ñita");
      const held = await participationOn(3);
      const edition = await prisma.edition.findUniqueOrThrow({ where: { year: 2025 } });

      const result = await getOpenParticipationByUserId(ana.id);

      expect(result).toMatchObject({
        day: { dayNumber: 3, id: held.dayId },
        edition: { name: edition.name, status: EditionStatus.ACTIVE, year: 2025 },
        id: held.id,
        tea: null,
        userId: ana.id,
        year: 2025,
      });
    });

    it("carries the tea with its story and the images in their order", async () => {
      const manager = await userNamed("Deinos");
      const held = await participationOn(1);
      const tea = (await teaWithStoryOf(held.id))!;
      const [first, second, third] = tea.story!.images;
      // Reordered so that the order of the rows on disk and their position differ.
      await replaceStoryImages(tea.story!.id, [
        { id: third.id, kind: "existing" },
        { id: first.id, kind: "existing" },
        { id: second.id, kind: "existing" },
      ]);

      const result = await getOpenParticipationByUserId(manager.id);

      expect(result?.tea).toMatchObject({
        id: tea.id,
        name: "Ruta del desierto",
        story: {
          id: tea.story!.id,
          storyPart1: "Todo pasó hace tiempo",
        },
      });
      expect(result?.tea?.story?.images.map((image) => [image.publicId, image.order])).toEqual([
        [third.publicId, 0],
        [first.publicId, 1],
        [second.publicId, 2],
      ]);
    });

    it("gives a null day to a participation that has none yet", async () => {
      const admin = await userNamed("CarlosC");
      const enrolled = await enrolUser(2025, admin.id);

      const result = await getOpenParticipationByUserId(admin.id);

      expect(result).toMatchObject({ day: null, id: enrolled.id, tea: null, year: 2025 });
    });

    it("prefers the active edition over one in preparation", async () => {
      const ana = await userNamed("Ñita");
      const active = await participationOn(3);
      await upsertEdition(2030, EditionStatus.PREPARING);
      await enrolUser(2030, ana.id);

      const result = await getOpenParticipationByUserId(ana.id);

      expect(result).toMatchObject({ edition: { status: EditionStatus.ACTIVE, year: 2025 }, id: active.id });
    });

    it("falls back to the edition in preparation with the highest year when there is none active for them", async () => {
      const admin = await userNamed("CarlosC");
      // Created in this order so that neither the first nor the last one created is the answer by accident.
      await upsertEdition(2030, EditionStatus.PREPARING);
      await upsertEdition(2032, EditionStatus.PREPARING);
      await upsertEdition(2031, EditionStatus.PREPARING);
      await enrolUser(2030, admin.id);
      const highest = await enrolUser(2032, admin.id);
      await enrolUser(2031, admin.id);

      const result = await getOpenParticipationByUserId(admin.id);

      expect(result).toMatchObject({
        edition: { status: EditionStatus.PREPARING, year: 2032 },
        id: highest.id,
        year: 2032,
      });
    });

    it("falls back to an edition in preparation when the edition they played is archived", async () => {
      const ana = await userNamed("Ñita");
      await upsertEdition(2030, EditionStatus.PREPARING);
      const next = await enrolUser(2030, ana.id);
      await setEditionStatus(EditionStatus.ARCHIVED);

      const result = await getOpenParticipationByUserId(ana.id);

      expect(result).toMatchObject({ edition: { status: EditionStatus.PREPARING, year: 2030 }, id: next.id });
    });

    it("never returns a participation in an archived edition, even one with a higher year", async () => {
      const admin = await userNamed("CarlosC");
      await participationIn(2033, EditionStatus.ARCHIVED, admin.id, 1);
      await upsertEdition(2030, EditionStatus.PREPARING);
      const preparing = await enrolUser(2030, admin.id);

      const result = await getOpenParticipationByUserId(admin.id);

      expect(result?.id).toBe(preparing.id);
    });

    it("returns null when the user is only in archived editions", async () => {
      const admin = await userNamed("CarlosC");
      await participationIn(2024, EditionStatus.ARCHIVED, admin.id, 1);

      expect(await getOpenParticipationByUserId(admin.id)).toBeNull();
    });

    it("returns null when the user is enrolled nowhere, and for an unknown user", async () => {
      const admin = await userNamed("CarlosC");

      expect(await getOpenParticipationByUserId(admin.id)).toBeNull();
      expect(await getOpenParticipationByUserId("no-such-user")).toBeNull();
    });

    it("never carries the guest token", async () => {
      const ana = await userNamed("Ñita");
      const held = await participationOn(3);
      // Whether a user's participation can get a token or not, this one has one the payload could leak.
      await prisma.participation.update({ data: { guestToken: "token-of-ana" }, where: { id: held.id } });

      const result = await getOpenParticipationByUserId(ana.id);

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty("guestToken");
      const payload = JSON.stringify(result);
      expect(payload).not.toContain("token-of-ana");
      expect(payload).not.toContain("guestToken");
    });
  });

  describe("isParticipationDayPlayed", () => {
    it("is false for a participation without a day, even in the middle of the edition", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");

      expect(await isParticipationDayPlayed(enrolled.id, duringTheEdition)).toBe(false);
    });

    it("is false for an unknown participation", async () => {
      expect(await isParticipationDayPlayed("no-such-participation", duringTheEdition)).toBe(false);
    });

    it("follows the schedule of an active edition: closed the evening before, open from midnight of the day", async () => {
      const ana = await participationOn(3);

      expect(await isParticipationDayPlayed(ana.id, beforeTheEdition)).toBe(false);
      expect(await isParticipationDayPlayed(ana.id, new Date("2025-12-02T23:59:00+01:00"))).toBe(false);
      expect(await isParticipationDayPlayed(ana.id, new Date("2025-12-03T07:00:00+01:00"))).toBe(true);
      expect(await isParticipationDayPlayed(ana.id, duringTheEdition)).toBe(true);
    });

    it("looks at the day of that participation, not at the others", async () => {
      const ana = await participationOn(3);
      const miko = await participationOn(5);
      const onTheFourth = new Date("2025-12-04T10:00:00+01:00");

      expect(await isParticipationDayPlayed(ana.id, onTheFourth)).toBe(true);
      expect(await isParticipationDayPlayed(miko.id, onTheFourth)).toBe(false);
    });

    it("does not open the days of an edition in preparation by date", async () => {
      await setEditionStatus(EditionStatus.PREPARING);
      const ana = await participationOn(3);

      expect(await isParticipationDayPlayed(ana.id, duringTheEdition)).toBe(false);
    });

    it("treats every day of an archived edition as played", async () => {
      await setEditionStatus(EditionStatus.ARCHIVED);
      const ana = await participationOn(3);

      expect(await isParticipationDayPlayed(ana.id, beforeTheEdition)).toBe(true);
    });

    it("is true for a day with a guess, before it has opened", async () => {
      const ana = await participationOn(3);
      await addGuess(3);

      expect(await isParticipationDayPlayed(ana.id, beforeTheEdition)).toBe(true);
    });

    it("is true for a day with a guess in an edition in preparation", async () => {
      await setEditionStatus(EditionStatus.PREPARING);
      const ana = await participationOn(3);
      await addGuess(3);

      expect(await isParticipationDayPlayed(ana.id, duringTheEdition)).toBe(true);
    });

    it.each([
      { guessed: 2030, held: 2025 },
      { guessed: 2025, held: 2030 },
    ])("does not count a guess on day 3 of $guessed for the holder of day 3 of $held", async ({ guessed, held }) => {
      await setEditionStatus(EditionStatus.PREPARING);
      await upsertEdition(2030, EditionStatus.PREPARING);
      const guest = await enrolGuest(2030, "Fantasma");
      const three2030 = await prisma.day.create({ data: { dayNumber: 3, year: 2030 } });
      await prisma.participation.update({ data: { dayId: three2030.id }, where: { id: guest.id } });
      await addGuess(3, guessed);
      const holder = await participationOn(3, held);

      expect(await isParticipationDayPlayed(holder.id, duringTheEdition)).toBe(false);
    });
  });

  describe("saveParticipationTea", () => {
    describe("creating the tea", () => {
      it("creates the tea of a participation that has none, with every field, and says it created it", async () => {
        const ana = await participationOn(3);

        const result = await saveParticipationTea(ana.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        const tea = await teaWithStoryOf(ana.id);
        expect(result).toEqual({ created: true, removedPublicIds: [], teaId: tea!.id });
        expect(tea).toMatchObject({
          addMilk: true,
          canReinfuse: true,
          hasTheine: true,
          infusionTime: 4,
          moreIndications: "Sin azúcar",
          name: "Té de la casa",
          participationId: ana.id,
          reinfuseNumber: 2,
          storeName: "La tetera azul",
          temperature: 85,
          url: "https://www.example.com/te-de-la-casa",
        });
      });

      it("stores the optional fields left out as null", async () => {
        const ana = await participationOn(3);

        await saveParticipationTea(ana.id, teaInput({ content: bareContent }), REFUSE_PLAYED, beforeTheEdition);

        expect(await teaWithStoryOf(ana.id)).toMatchObject({
          moreIndications: null,
          name: "Té sin más",
          reinfuseNumber: null,
          storeName: null,
          url: null,
        });
      });

      it("stores blank optional fields as null", async () => {
        const ana = await participationOn(3);
        const blanks = { ...bareContent, moreIndications: "   ", storeName: "", url: " \t " };

        await saveParticipationTea(ana.id, teaInput({ content: blanks }), REFUSE_PLAYED, beforeTheEdition);

        expect(await teaWithStoryOf(ana.id)).toMatchObject({ moreIndications: null, storeName: null, url: null });
      });

      it("creates the tea of someone enrolled without a day", async () => {
        const enrolled = await enrolGuest(2025, "Prima Lejana");

        // Never played without a day, even in the middle of the edition and with the played days refused.
        const result = await saveParticipationTea(enrolled.id, teaInput(), REFUSE_PLAYED, duringTheEdition);

        expect(result.created).toBe(true);
        expect((await teaWithStoryOf(enrolled.id))?.id).toBe(result.teaId);
      });

      it("creates no story when there is no story text, no music and no image", async () => {
        const ana = await participationOn(3);

        await saveParticipationTea(ana.id, teaInput({ story: noStory }), REFUSE_PLAYED, beforeTheEdition);

        expect((await teaWithStoryOf(ana.id))?.story).toBeNull();
      });

      it("creates no story when every story field is blank", async () => {
        const ana = await participationOn(3);
        const blankStory = { onlyMusic: false, storyPart1: "  ", storyPart2: "", storyPart3: "\n", youtubeURL: " " };

        await saveParticipationTea(ana.id, teaInput({ story: blankStory }), REFUSE_PLAYED, beforeTheEdition);

        expect((await teaWithStoryOf(ana.id))?.story).toBeNull();
      });

      it.each([
        { story: { onlyMusic: false, storyPart1: "Érase una vez" }, what: "the first part" },
        { story: { onlyMusic: false, storyPart2: "un té" }, what: "the second part" },
        { story: { onlyMusic: false, storyPart3: "que nadie adivinó" }, what: "the third part" },
        { story: { onlyMusic: false, youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk" }, what: "a song" },
        { story: { onlyMusic: true }, what: "only music" },
      ])("creates the story when it has $what alone, with the rest null", async ({ story }) => {
        const ana = await participationOn(3);

        await saveParticipationTea(ana.id, teaInput({ story }), REFUSE_PLAYED, beforeTheEdition);

        expect((await teaWithStoryOf(ana.id))?.story).toMatchObject({
          images: [],
          onlyMusic: story.onlyMusic,
          storyPart1: story.storyPart1 ?? null,
          storyPart2: story.storyPart2 ?? null,
          storyPart3: story.storyPart3 ?? null,
          youtubeURL: story.youtubeURL ?? null,
        });
      });

      it("creates the story when there is only an image, with the images in the order given", async () => {
        const ana = await participationOn(3);
        const images = [
          { kind: "new" as const, publicId: "advientea-local/2025/teaDay/second" },
          { kind: "new" as const, publicId: "advientea-local/2025/teaDay/first" },
        ];

        const result = await saveParticipationTea(ana.id, teaInput({ images }), REFUSE_PLAYED, beforeTheEdition);

        const story = (await teaWithStoryOf(ana.id))?.story;
        expect(story).toMatchObject({ storyPart1: null, storyPart2: null, storyPart3: null, youtubeURL: null });
        expect(story?.images.map((image) => [image.publicId, image.order])).toEqual([
          ["advientea-local/2025/teaDay/second", 0],
          ["advientea-local/2025/teaDay/first", 1],
        ]);
        expect(result.removedPublicIds).toEqual([]);
      });

      it("creates no story for a new tea when its only slots are existing images", async () => {
        const ana = await participationOn(3);
        const manager = await participationOn(1);
        const theirs = (await teaWithStoryOf(manager.id))!.story!;

        const result = await saveParticipationTea(
          ana.id,
          teaInput({
            images: [
              { id: theirs.images[0].id, kind: "existing" },
              { id: "no-such-image", kind: "existing" },
            ],
            story: noStory,
          }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        expect(result.created).toBe(true);
        expect((await teaWithStoryOf(ana.id))!.story).toBeNull();
        expect(result.removedPublicIds).toEqual([]);
        expect((await teaWithStoryOf(manager.id))!.story!.images).toEqual(theirs.images);
      });

      it("ignores the existing images named for a new tea, and never touches the story they belong to", async () => {
        const ana = await participationOn(3);
        const manager = await participationOn(1);
        const theirs = (await teaWithStoryOf(manager.id))!.story!;

        const result = await saveParticipationTea(
          ana.id,
          teaInput({
            images: [
              { id: theirs.images[0].id, kind: "existing" },
              { kind: "new", publicId: "advientea-local/2025/teaDay/mine" },
              { id: "no-such-image", kind: "existing" },
            ],
            story: fullStory,
          }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        const mine = (await teaWithStoryOf(ana.id))!.story!;
        expect(mine.images.map((image) => [image.publicId, image.order])).toEqual([
          ["advientea-local/2025/teaDay/mine", 0],
        ]);
        expect(result.removedPublicIds).toEqual([]);
        expect((await teaWithStoryOf(manager.id))!.story!.images).toEqual(theirs.images);
      });

      it("leaves the participation on its day", async () => {
        const ana = await participationOn(3);

        await saveParticipationTea(ana.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        const after = await prisma.participation.findUniqueOrThrow({ where: { id: ana.id } });
        expect(after).toEqual({ ...ana, updatedAt: after.updatedAt });
      });
    });

    describe("updating the tea", () => {
      it("updates the content of the existing tea, keeps it on the participation and says it did not create it", async () => {
        const manager = await participationOn(1);
        const before = (await teaWithStoryOf(manager.id))!;
        const teaCount = await prisma.tea.count();

        const result = await saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        expect(result.created).toBe(false);
        expect(result.teaId).toBe(before.id);
        expect(await prisma.tea.count()).toBe(teaCount);
        expect(await teaWithStoryOf(manager.id)).toMatchObject({
          addMilk: true,
          canReinfuse: true,
          hasTheine: true,
          id: before.id,
          infusionTime: 4,
          moreIndications: "Sin azúcar",
          name: "Té de la casa",
          participationId: manager.id,
          reinfuseNumber: 2,
          storeName: "La tetera azul",
          temperature: 85,
          url: "https://www.example.com/te-de-la-casa",
        });
      });

      it("never touches the type or the ingredients of the tea", async () => {
        const manager = await participationOn(1);
        const before = (await teaWithStoryOf(manager.id))!;
        expect(before.teaType).toBe(TeaType.ROOIBOS);
        expect(before.ingredients).toHaveLength(2);

        await saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        const after = (await teaWithStoryOf(manager.id))!;
        expect(after.teaType).toBe(TeaType.ROOIBOS);
        expect(after.ingredients).toEqual(before.ingredients);
      });

      it("clears the optional fields that are left out or blank", async () => {
        const manager = await participationOn(1);
        const blanks = { ...bareContent, moreIndications: "  ", storeName: undefined, url: "" };

        await saveParticipationTea(manager.id, teaInput({ content: blanks }), REFUSE_PLAYED, beforeTheEdition);

        expect(await teaWithStoryOf(manager.id)).toMatchObject({
          moreIndications: null,
          reinfuseNumber: null,
          storeName: null,
          url: null,
        });
      });

      it("sets the fields of the existing story to the ones given, blank ones as null", async () => {
        const manager = await participationOn(1);
        const before = (await teaWithStoryOf(manager.id))!.story!;
        const story = { onlyMusic: true, storyPart1: "Otra historia", storyPart2: "   ", storyPart3: undefined };

        await saveParticipationTea(manager.id, teaInput({ story }), REFUSE_PLAYED, beforeTheEdition);

        expect((await teaWithStoryOf(manager.id))!.story).toMatchObject({
          id: before.id,
          onlyMusic: true,
          storyPart1: "Otra historia",
          storyPart2: null,
          storyPart3: null,
          youtubeURL: null,
        });
      });

      it("never deletes the story, even when everything in it is emptied, and deletes its images", async () => {
        const manager = await participationOn(1);
        const before = (await teaWithStoryOf(manager.id))!.story!;
        const storyCount = await prisma.storyTea.count();

        const result = await saveParticipationTea(
          manager.id,
          teaInput({ images: [], story: noStory }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        const after = (await teaWithStoryOf(manager.id))!.story;
        expect(after).toMatchObject({
          id: before.id,
          images: [],
          storyPart1: null,
          storyPart2: null,
          storyPart3: null,
          youtubeURL: null,
        });
        expect(await prisma.storyTea.count()).toBe(storyCount);
        expect(result.removedPublicIds.toSorted()).toEqual(before.images.map((image) => image.publicId).toSorted());
      });

      it("makes the images match the slots in their order and returns the public ids of the ones it deleted", async () => {
        const manager = await participationOn(1);
        const [first, second, third] = (await teaWithStoryOf(manager.id))!.story!.images;

        const result = await saveParticipationTea(
          manager.id,
          teaInput({
            images: [
              { id: third.id, kind: "existing" },
              { kind: "new", publicId: "advientea-local/2025/teaDay/new" },
              { id: first.id, kind: "existing" },
            ],
            story: fullStory,
          }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        const images = (await teaWithStoryOf(manager.id))!.story!.images;
        expect(images.map((image) => [image.publicId, image.order])).toEqual([
          [third.publicId, 0],
          ["advientea-local/2025/teaDay/new", 1],
          [first.publicId, 2],
        ]);
        expect(images[0].id).toBe(third.id);
        expect(images[2].id).toBe(first.id);
        expect(result).toMatchObject({ created: false, removedPublicIds: [second.publicId] });
      });

      it("ignores existing ids that are not images of this story and never touches the story they belong to", async () => {
        const manager = await participationOn(1);
        const guest = await participationOn(2);
        const mine = (await teaWithStoryOf(manager.id))!.story!;
        const theirs = (await teaWithStoryOf(guest.id))!.story!;

        const result = await saveParticipationTea(
          manager.id,
          teaInput({
            images: [
              { id: theirs.images[0].id, kind: "existing" },
              { id: mine.images[1].id, kind: "existing" },
              { id: "no-such-image", kind: "existing" },
            ],
            story: fullStory,
          }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        const after = (await teaWithStoryOf(manager.id))!.story!.images;
        expect(after.map((image) => [image.id, image.order])).toEqual([[mine.images[1].id, 0]]);
        expect(result.removedPublicIds.toSorted()).toEqual(
          [mine.images[0].publicId, mine.images[2].publicId].toSorted(),
        );
        expect((await teaWithStoryOf(guest.id))!.story!.images).toEqual(theirs.images);
      });

      it("creates the story of an existing tea that had none when there is something to tell", async () => {
        const ana = await participationOn(3);
        const tea = await addTea(bareContent, [], ana.id);

        const result = await saveParticipationTea(
          ana.id,
          teaInput({ images: [{ kind: "new", publicId: "advientea-local/2025/teaDay/one" }], story: fullStory }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        expect(result).toEqual({ created: false, removedPublicIds: [], teaId: tea.id });
        const story = (await teaWithStoryOf(ana.id))!.story;
        expect(story).toMatchObject({
          storyPart1: "Érase una vez",
          storyPart2: "un té",
          storyPart3: "que nadie adivinó",
          youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        });
        expect(story?.images.map((image) => [image.publicId, image.order])).toEqual([
          ["advientea-local/2025/teaDay/one", 0],
        ]);
      });

      it("creates no story for an existing tea that had none when there is nothing to tell", async () => {
        const ana = await participationOn(3);
        await addTea(bareContent, [], ana.id);

        await saveParticipationTea(ana.id, teaInput({ story: noStory }), REFUSE_PLAYED, beforeTheEdition);

        expect((await teaWithStoryOf(ana.id))!.story).toBeNull();
      });

      it("creates no story for an existing tea that had none when its only slots are existing images", async () => {
        const ana = await participationOn(3);
        await addTea(bareContent, [], ana.id);
        const manager = await participationOn(1);
        const theirs = (await teaWithStoryOf(manager.id))!.story!;

        const result = await saveParticipationTea(
          ana.id,
          teaInput({
            images: [
              { id: theirs.images[0].id, kind: "existing" },
              { id: "no-such-image", kind: "existing" },
            ],
            story: noStory,
          }),
          REFUSE_PLAYED,
          beforeTheEdition,
        );

        expect((await teaWithStoryOf(ana.id))!.story).toBeNull();
        expect(result.removedPublicIds).toEqual([]);
        expect((await teaWithStoryOf(manager.id))!.story!.images).toEqual(theirs.images);
      });

      it("leaves the participation on its day and the tea on the participation", async () => {
        const manager = await participationOn(1);
        const teaBefore = (await teaWithStoryOf(manager.id))!;

        await saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        const after = await prisma.participation.findUniqueOrThrow({ where: { id: manager.id } });
        expect(after).toEqual({ ...manager, updatedAt: after.updatedAt });
        expect((await teaWithStoryOf(manager.id))!.id).toBe(teaBefore.id);
      });

      it("leaves the other teas as they were", async () => {
        const manager = await participationOn(1);
        const guest = await participationOn(2);
        const guestTea = await teaWithStoryOf(guest.id);

        await saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        expect(await teaWithStoryOf(guest.id)).toEqual(guestTea);
      });
    });

    describe("refusals", () => {
      it("refuses an unknown participation and writes nothing", async () => {
        const before = await everything();

        await expectConflict(
          saveParticipationTea("no-such-participation", teaInput(), ALLOW_PLAYED, beforeTheEdition),
          NO_LONGER_ENROLLED,
        );
        expect(await everything()).toEqual(before);
      });

      it("refuses a participation of an archived edition when asked to, whatever is said about played days", async () => {
        const ana = await participationOn(3);
        const manager = await participationOn(1);
        const enrolled = await enrolGuest(2025, "Prima Lejana");
        await setEditionStatus(EditionStatus.ARCHIVED);
        const before = await everything();

        for (const options of [ALLOW_PLAYED, REFUSE_PLAYED]) {
          await expectConflict(
            saveParticipationTea(ana.id, teaInput(), options, beforeTheEdition),
            editionArchived(2025),
          );
          await expectConflict(
            saveParticipationTea(manager.id, teaInput({ story: fullStory }), options, beforeTheEdition),
            editionArchived(2025),
          );
          await expectConflict(
            saveParticipationTea(enrolled.id, teaInput(), options, beforeTheEdition),
            editionArchived(2025),
          );
        }
        expect(await everything()).toEqual(before);
      });

      it("names the year of the archived edition", async () => {
        const admin = await userNamed("CarlosC");
        const old = await participationIn(2024, EditionStatus.ARCHIVED, admin.id);

        await expectConflict(
          saveParticipationTea(old.id, teaInput(), ALLOW_PLAYED, beforeTheEdition),
          editionArchived(2024),
        );
        expect(await prisma.tea.count({ where: { participationId: old.id } })).toBe(0);
      });

      it("saves a participation of an archived edition when not asked to refuse it, creating and updating", async () => {
        const ana = await participationOn(3);
        const manager = await participationOn(1);
        await setEditionStatus(EditionStatus.ARCHIVED);

        const created = await saveParticipationTea(ana.id, teaInput(), ALLOW_ALL, duringTheEdition);
        const updated = await saveParticipationTea(manager.id, teaInput(), ALLOW_ALL, duringTheEdition);

        expect(created.created).toBe(true);
        expect(updated.created).toBe(false);
        expect((await teaWithStoryOf(ana.id))?.name).toBe("Té de la casa");
        expect((await teaWithStoryOf(manager.id))?.name).toBe("Té de la casa");
      });

      it("creates the missing tea of a day that has opened, even when asked to refuse played days", async () => {
        const ana = await participationOn(3);
        await addGuess(3);

        const result = await saveParticipationTea(ana.id, teaInput(), REFUSE_PLAYED, duringTheEdition);

        expect(result.created).toBe(true);
        expect((await teaWithStoryOf(ana.id))?.id).toBe(result.teaId);
      });

      it("refuses a day that has opened when asked to, changing nothing of the tea, its story or its images", async () => {
        const manager = await participationOn(1);
        const before = await everything();

        await expectConflict(
          saveParticipationTea(
            manager.id,
            teaInput({ images: [{ kind: "new", publicId: "advientea-local/2025/teaDay/late" }], story: fullStory }),
            REFUSE_PLAYED,
            duringTheEdition,
          ),
          DAY_PLAYED,
        );
        expect(await everything()).toEqual(before);
      });

      it("refuses to update the tea of a day with guesses when asked to, before it has opened", async () => {
        const manager = await participationOn(1);
        await addGuess(1);
        const before = await everything();

        await expectConflict(saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, beforeTheEdition), DAY_PLAYED);
        expect(await everything()).toEqual(before);
      });

      it("does not refuse a day because of a guess on the same day number of another edition", async () => {
        await upsertEdition(2030, EditionStatus.PREPARING);
        await addGuess(3, 2030);
        const ana = await participationOn(3);

        const result = await saveParticipationTea(ana.id, teaInput(), REFUSE_PLAYED, beforeTheEdition);

        expect(result.created).toBe(true);
      });

      it("reports the archived edition before the played day", async () => {
        const manager = await participationOn(1);
        await addGuess(1);
        await setEditionStatus(EditionStatus.ARCHIVED);

        await expectConflict(
          saveParticipationTea(manager.id, teaInput(), REFUSE_PLAYED, duringTheEdition),
          editionArchived(2025),
        );
      });

      it("lets a played day through when not asked to refuse it", async () => {
        const manager = await participationOn(1);
        const ana = await participationOn(3);
        await addGuess(3);

        const updated = await saveParticipationTea(manager.id, teaInput(), ALLOW_PLAYED, duringTheEdition);
        const created = await saveParticipationTea(ana.id, teaInput(), ALLOW_PLAYED, duringTheEdition);

        expect(updated.created).toBe(false);
        expect((await teaWithStoryOf(manager.id))?.name).toBe("Té de la casa");
        expect(created.created).toBe(true);
        expect((await teaWithStoryOf(ana.id))?.name).toBe("Té de la casa");
      });

      it.each(["P2025", "P2003"])(
        "reports a participation deleted mid-flight (%s) as no longer there",
        async (code) => {
          const manager = await participationOn(1);
          const before = await everything();
          const transaction = failNextTransaction(code);

          await expectConflict(
            saveParticipationTea(manager.id, teaInput(), ALLOW_PLAYED, beforeTheEdition),
            NO_LONGER_ENROLLED,
          );
          // Without this the call could have answered before ever writing, and the clash would not be exercised.
          expect(transaction).toHaveBeenCalled();
          expect(await everything()).toEqual(before);
        },
      );
    });

    describe("races", () => {
      it("settles two first saves of the same participation with exactly one tea", async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);

          const results = await Promise.all([
            saveParticipationTea(
              racer.id,
              teaInput({ content: { ...fullContent, name: "Primero" } }),
              REFUSE_PLAYED,
              beforeTheEdition,
            ),
            saveParticipationTea(
              racer.id,
              teaInput({ content: { ...fullContent, name: "Segundo" } }),
              REFUSE_PLAYED,
              beforeTheEdition,
            ),
          ]);

          expect(results.map((result) => result.created).toSorted()).toEqual([false, true]);
          expect(results[0].teaId).toBe(results[1].teaId);
          const teas = await prisma.tea.findMany({ where: { participationId: racer.id } });
          expect(teas).toHaveLength(1);
          expect(teas[0].id).toBe(results[0].teaId);
          // The second one to get in updated the tea the first one created.
          const second = results.find((result) => !result.created) === results[0] ? "Primero" : "Segundo";
          expect(teas[0].name).toBe(second);
        }
      });

      it("settles a first save that races the unenrolment of the same person: never a tea without its participation", async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);

          const [saved, unenrolled] = await Promise.allSettled([
            saveParticipationTea(racer.id, teaInput(), REFUSE_PLAYED, beforeTheEdition),
            unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
          ]);

          // One of the two gives way, as a conflict.
          expect([saved.status, unenrolled.status].toSorted()).toEqual(["fulfilled", "rejected"]);
          const participation = await prisma.participation.findUnique({ where: { id: racer.id } });
          const teas = await prisma.tea.findMany({ where: { participationId: racer.id } });
          if (saved.status === "rejected") {
            expect(saved.reason).toBeInstanceOf(ConflictError);
            expect((saved.reason as ConflictError).message).toBe(NO_LONGER_ENROLLED);
            expect(participation).toBeNull();
            expect(teas).toHaveLength(0);
          } else {
            expect(unenrolled.status === "rejected" && unenrolled.reason).toBeInstanceOf(ConflictError);
            expect(participation).not.toBeNull();
            expect(teas.map((tea) => tea.id)).toEqual([saved.value.teaId]);
          }
        }
      });

      it("settles a save that replaces the images racing the unenrolment that deletes the tea", async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);
          const tea = await addTea(bareContent, [], racer.id);
          const story = await addStoryTea({ storyPart1: "Érase una vez" }, tea.id);
          const originals = [
            `advientea-local/2025/teaDay/kept-${round}`,
            `advientea-local/2025/teaDay/dropped-${round}`,
          ];
          await replaceStoryImages(
            story.id,
            originals.map((publicId) => ({ kind: "new" as const, publicId })),
          );
          const kept = await prisma.storyImage.findFirstOrThrow({ where: { publicId: originals[0] } });
          const added = `advientea-local/2025/teaDay/added-${round}`;

          const [saved, unenrolled] = await Promise.allSettled([
            saveParticipationTea(
              racer.id,
              teaInput({
                images: [
                  { id: kept.id, kind: "existing" },
                  { kind: "new", publicId: added },
                ],
                story: fullStory,
              }),
              REFUSE_PLAYED,
              beforeTheEdition,
            ),
            unenrolParticipant(racer.id, { deleteTea: true }, beforeTheEdition),
          ]);

          // The unenrolment always goes through: after the save it deletes what the save left, before it the save finds nobody.
          if (unenrolled.status !== "fulfilled") {
            throw new Error(`the unenrolment failed: ${String(unenrolled.reason)}`);
          }
          expect(await prisma.participation.findUnique({ where: { id: racer.id } })).toBeNull();
          expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
          expect(await prisma.storyImage.count({ where: { storyTeaId: story.id } })).toBe(0);
          if (saved.status === "rejected") {
            expect(saved.reason).toBeInstanceOf(ConflictError);
            expect((saved.reason as ConflictError).message).toBe(NO_LONGER_ENROLLED);
            expect(unenrolled.value.storyImagePublicIds.toSorted()).toEqual(originals.toSorted());
          } else {
            expect(saved.value.removedPublicIds).toEqual([originals[1]]);
            expect(unenrolled.value.storyImagePublicIds.toSorted()).toEqual([originals[0], added].toSorted());
          }
        }
      });
    });
  });
});
