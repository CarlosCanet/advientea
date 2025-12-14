import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addTea, editTea } from "@/lib/dal";
import { TeaType } from "@/generated/prisma/enums";

describe("dal Tea", () => {
  describe("addTea", () => {
    it("should create a tea linked to a real day in the DB", async () => {
      const apple = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Manzana" } });
      const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
      const newTea = await addTea(
        {
          name: "Integration Tea",
          teaType: TeaType.GREEN,
          infusionTime: 3,
          temperature: 80,
          hasTheine: true,
          canReinfuse: false,
          addMilk: false,
        },
        [apple.id, lemon.id],
        20,
        2025
      );

      expect(newTea).not.toBeNull();
      expect(newTea?.day?.dayNumber).toBe(20);

      const savedInDb = await prisma.tea.findUnique({ where: { id: newTea!.id }, include: { ingredients: true } });
      expect(savedInDb?.name).toBe("Integration Tea");
      const ingredientsName = savedInDb!.ingredients.map(ingredient => ingredient.name);
      expect(ingredientsName).toHaveLength(2);
      expect(ingredientsName).toContain("Manzana");
      expect(ingredientsName).toContain("Limón");
    });

    it("should enforce Unique Constraint on DayId", async () => {
      await addTea(
        { name: "Tea 21", teaType: TeaType.BLACK, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true },
        [],
        21,
        2025
      );
      await expect(
        addTea({ name: "Tea 21", teaType: TeaType.WHITE, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true }, [], 21, 2025)
      ).rejects.toThrow();
    });
  })

  describe("editTea", () => {
    it("should update basic fields correctly", async () => {
      const result = await addTea(
        { name: "Tea 21", teaType: TeaType.BLACK, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true },
        [],
        21,
        2025
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
        { name: "Tea 21", teaType: TeaType.BLACK, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true },
        [apple.id, chocolate.id],
        21,
        2025
      );
      await editTea({ ingredientIds: [apple.id, lemon.id, orange.id]}, result!.id);
      const editedTea = await prisma.tea.findUnique({ where: { id: result!.id }, include: { ingredients: true } });
      expect(editedTea!.ingredients).toHaveLength(3);
      const ingredientsName = editedTea!.ingredients.map(ingredient => ingredient.name);
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
