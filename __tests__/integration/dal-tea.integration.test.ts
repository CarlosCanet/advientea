import { describe, expect, expectTypeOf, it } from "vitest";

import { TeaType } from "@/generated/prisma/enums";
import { addTea, type TeaContentInput, updateTeaContent } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

describe("dal Tea", () => {
  describe("addTea", () => {
    it("should create a tea linked to a real day in the DB", async () => {
      const apple = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Manzana" } });
      const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
      const newTea = await addTea(
        {
          addMilk: false,
          canReinfuse: false,
          hasTheine: true,
          infusionTime: 3,
          name: "Integration Tea",
          teaType: TeaType.GREEN,
          temperature: 80,
        },
        [apple.id, lemon.id],
        {
          dayNumber: 20,
          year: 2025,
        },
      );

      expect(newTea).not.toBeNull();
      expect(newTea?.day?.dayNumber).toBe(20);

      const savedInDb = await prisma.tea.findUnique({ include: { ingredients: true }, where: { id: newTea!.id } });
      expect(savedInDb?.name).toBe("Integration Tea");
      const ingredientsName = savedInDb!.ingredients.map((ingredient) => ingredient.name);
      expect(ingredientsName).toHaveLength(2);
      expect(ingredientsName).toContain("Manzana");
      expect(ingredientsName).toContain("Limón");
    });

    it("should enforce Unique Constraint on DayId", async () => {
      await addTea(
        {
          addMilk: true,
          canReinfuse: true,
          hasTheine: true,
          infusionTime: 1,
          name: "Tea 21",
          teaType: TeaType.BLACK,
          temperature: 1,
        },
        [],
        {
          dayNumber: 21,
          year: 2025,
        },
      );
      await expect(
        addTea(
          {
            addMilk: true,
            canReinfuse: true,
            hasTheine: true,
            infusionTime: 1,
            name: "Tea 21",
            teaType: TeaType.WHITE,
            temperature: 1,
          },
          [],
          {
            dayNumber: 21,
            year: 2025,
          },
        ),
      ).rejects.toThrow();
    });
  });

  describe("updateTeaContent", () => {
    // The seed puts a tea with ingredients and a story on day 1 of 2025, assigned to the manager.
    async function seededTea() {
      return prisma.tea.findFirstOrThrow({
        include: { day: { include: { assignment: true } }, ingredients: true },
        where: { day: { dayNumber: 1, year: 2025 } },
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

    it("leaves the day and its assignment where they were", async () => {
      const tea = await seededTea();

      await updateTeaContent(tea.id, { name: "Té editado" });

      const after = await prisma.tea.findUniqueOrThrow({
        include: { day: { include: { assignment: true } } },
        where: { id: tea.id },
      });
      expect(after.dayId).toBe(tea.dayId);
      expect(after.day?.assignment?.id).toBe(tea.day?.assignment?.id);
    });

    it("cannot be asked to move the tea: the content type has no day", () => {
      expectTypeOf<TeaContentInput>().not.toHaveProperty("dayId");
      expectTypeOf<TeaContentInput>().not.toHaveProperty("day");
    });
  });
});
