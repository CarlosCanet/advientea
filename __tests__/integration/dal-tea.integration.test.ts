import { describe, expect, expectTypeOf, it } from "vitest";

import { TeaType } from "@/generated/prisma/enums";
import {
  addTea,
  deleteTea,
  enrolGuest,
  getTeaById,
  getUsernameAssignedToTea,
  type TeaContentInput,
  updateTeaContent,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const teaData = {
  addMilk: false,
  canReinfuse: false,
  hasTheine: true,
  infusionTime: 3,
  name: "Integration Tea",
  teaType: TeaType.GREEN,
  temperature: 80,
};

// The seed gives day 1 of 2025 to the manager and day 2 to the guest "Anónimo", both with a tea;
// days 3, 4 and 5 go to ana, sony and miko, without one.
async function participationOfDay(dayNumber: number) {
  return prisma.participation.findFirstOrThrow({ where: { day: { dayNumber, year: 2025 } } });
}

describe("dal Tea", () => {
  describe("addTea", () => {
    it("creates the tea of a participation, with its ingredients, and reaches the day through it", async () => {
      const apple = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Manzana" } });
      const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
      const participation = await participationOfDay(3);

      const newTea = await addTea(teaData, [apple.id, lemon.id], participation.id);

      expect(newTea.participationId).toBe(participation.id);
      expect(newTea.participation.day?.dayNumber).toBe(3);
      expect(newTea.participation.year).toBe(2025);
      const savedInDb = await prisma.tea.findUniqueOrThrow({
        include: { ingredients: true },
        where: { id: newTea.id },
      });
      expect(savedInDb.name).toBe("Integration Tea");
      expect(savedInDb.ingredients.map((ingredient) => ingredient.name).toSorted()).toEqual(["Limón", "Manzana"]);
    });

    it("creates the tea of someone enrolled who has no day yet", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");

      const newTea = await addTea(teaData, [], enrolled.id);

      expect(newTea.participation.day).toBeNull();
      expect(newTea.participation.year).toBe(2025);
    });

    it("refuses a second tea for the same participation", async () => {
      const participation = await participationOfDay(3);
      await addTea(teaData, [], participation.id);

      await expect(addTea({ ...teaData, name: "Otro" }, [], participation.id)).rejects.toThrow(/already has a tea/);
      expect(await prisma.tea.count({ where: { participationId: participation.id } })).toBe(1);
    });

    it("refuses a participation that does not exist", async () => {
      await expect(addTea(teaData, [], "no-such-participation")).rejects.toThrow(/does not exist/);
    });

    it("never hands the guest token out with the tea", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");

      const newTea = await addTea(teaData, [], enrolled.id);
      const read = await getTeaById(newTea.id);

      expect(JSON.stringify([newTea, read])).not.toContain(enrolled.guestToken!);
    });
  });

  describe("getTeaById", () => {
    it("returns the tea with its ingredients, its story and the day of its participation", async () => {
      const participation = await participationOfDay(1);
      const seeded = await prisma.tea.findUniqueOrThrow({ where: { participationId: participation.id } });

      const tea = await getTeaById(seeded.id);

      expect(tea?.name).toBe("Ruta del desierto");
      expect(tea?.ingredients).toHaveLength(2);
      expect(tea?.story?.images).toHaveLength(3);
      expect(tea?.participation).toMatchObject({ id: participation.id, userId: participation.userId, year: 2025 });
      expect(tea?.participation.day?.dayNumber).toBe(1);
    });

    it("returns null for a tea that does not exist", async () => {
      expect(await getTeaById("no-such-tea")).toBeNull();
    });
  });

  describe("getUsernameAssignedToTea", () => {
    it("returns the username when the tea belongs to an account", async () => {
      const tea = await prisma.tea.findFirstOrThrow({
        where: { participation: { day: { dayNumber: 1, year: 2025 } } },
      });

      expect(await getUsernameAssignedToTea(tea.id)).toBe("Deinos");
    });

    it("returns the guest name when the tea belongs to a guest", async () => {
      const tea = await prisma.tea.findFirstOrThrow({
        where: { participation: { day: { dayNumber: 2, year: 2025 } } },
      });

      expect(await getUsernameAssignedToTea(tea.id)).toBe("Anónimo");
    });

    it("returns null for a tea that does not exist", async () => {
      expect(await getUsernameAssignedToTea("no-such-tea")).toBeNull();
    });
  });

  describe("deleteTea", () => {
    it("deletes the tea with its story and leaves the participation and its day", async () => {
      const participation = await participationOfDay(1);
      const tea = await prisma.tea.findUniqueOrThrow({ where: { participationId: participation.id } });

      await deleteTea(tea.id);

      expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
      expect(await prisma.storyTea.count({ where: { teaId: tea.id } })).toBe(0);
      const after = await prisma.participation.findUniqueOrThrow({ where: { id: participation.id } });
      expect(after.dayId).toBe(participation.dayId);
    });
  });

  describe("updateTeaContent", () => {
    // The seed puts a tea with ingredients and a story on day 1 of 2025, assigned to the manager.
    async function seededTea() {
      return prisma.tea.findFirstOrThrow({
        include: { ingredients: true, participation: true },
        where: { participation: { day: { dayNumber: 1, year: 2025 } } },
      });
    }

    it("updates the tea's content", async () => {
      const tea = await seededTea();

      await updateTeaContent(tea.id, { name: "Té editado", teaType: TeaType.GREEN, temperature: 70 });

      const edited = await prisma.tea.findUniqueOrThrow({ where: { id: tea.id } });
      expect(edited).toMatchObject({ name: "Té editado", teaType: TeaType.GREEN, temperature: 70 });
    });

    it("replaces the ingredients with the given list", async () => {
      const tea = await seededTea();
      const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
      const orange = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Naranja" } });

      await updateTeaContent(tea.id, { ingredientIds: [lemon.id, orange.id] });

      const edited = await prisma.tea.findUniqueOrThrow({ include: { ingredients: true }, where: { id: tea.id } });
      expect(edited.ingredients.map((ingredient) => ingredient.name).toSorted()).toEqual(["Limón", "Naranja"]);
    });

    it("leaves the tea with its participation, and the participation on its day", async () => {
      const tea = await seededTea();

      await updateTeaContent(tea.id, { name: "Té editado" });

      const after = await prisma.tea.findUniqueOrThrow({ include: { participation: true }, where: { id: tea.id } });
      expect(after.participationId).toBe(tea.participationId);
      expect(after.participation.dayId).toBe(tea.participation.dayId);
    });

    it("cannot be asked to hand the tea to someone else: the content type has no participation", () => {
      expectTypeOf<TeaContentInput>().not.toHaveProperty("participationId");
      expectTypeOf<TeaContentInput>().not.toHaveProperty("participation");
    });
  });
});
