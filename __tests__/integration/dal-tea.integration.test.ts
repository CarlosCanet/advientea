import { describe, expect, it } from "vitest";

import { TeaType } from "@/generated/prisma/enums";
import { addTea, editTea } from "@/lib/dal";
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
        20,
        2025,
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
        21,
        2025,
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
          21,
          2025,
        ),
      ).rejects.toThrow();
    });
  });

  describe("editTea", () => {
    it("should update basic fields correctly", async () => {
      const result = await addTea(
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
        21,
        2025,
      );
      await editTea({ teaType: TeaType.GREEN }, result!.id);
      const editedTea = await prisma.tea.findUnique({ where: { id: result!.id } });
      expect(editedTea!.teaType).toBe(TeaType.GREEN);
    });

    it("should replace ingredients correctly", async () => {
      const apple = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Manzana" } });
      const chocolate = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Chocolate" } });
      const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
      const orange = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Naranja" } });
      const result = await addTea(
        {
          addMilk: true,
          canReinfuse: true,
          hasTheine: true,
          infusionTime: 1,
          name: "Tea 21",
          teaType: TeaType.BLACK,
          temperature: 1,
        },
        [apple.id, chocolate.id],
        21,
        2025,
      );
      await editTea({ ingredientIds: [apple.id, lemon.id, orange.id] }, result!.id);
      const editedTea = await prisma.tea.findUnique({ include: { ingredients: true }, where: { id: result!.id } });
      expect(editedTea!.ingredients).toHaveLength(3);
      const ingredientsName = editedTea!.ingredients.map((ingredient) => ingredient.name);
      expect(ingredientsName).toContain("Manzana");
      expect(ingredientsName).toContain("Limón");
      expect(ingredientsName).toContain("Naranja");
      expect(ingredientsName).not.toContain("Chocolate");
    });

    // it("should move tea from one day to another", async () => {

    // });

    // it("should prevent moving tea to an occupied day", async () => {

    // });
  });
});
