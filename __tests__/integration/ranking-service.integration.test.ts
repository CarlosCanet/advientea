import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDailyRanking } from "@/lib/services/ranking-service";
import { Day, TeaIngredient, TeaType, User } from "@/generated/prisma/client";
import { createTeaGuess } from "@/lib/dal";

describe("Ranking service", () => {
  let user1: User;
  let user2: User;
  let user3: User;
  let day1: Day;
  let day2: Day;
  let apple: TeaIngredient;
  let lemon: TeaIngredient;
  let cinnamon: TeaIngredient;
  beforeEach(async () => {
    user1 = await prisma.user.findFirstOrThrow({ where: { username: "Deinos" } });
    user2 = await prisma.user.findFirstOrThrow({ where: { username: "mikoalilla" } });
    user3 = await prisma.user.findFirstOrThrow({ where: { username: "Ñita" } });
    day1 = await prisma.day.findFirstOrThrow({ where: { dayNumber: 1, year: 2025 } });
    day2 = await prisma.day.findFirstOrThrow({ where: { dayNumber: 2, year: 2025 } });
    apple = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Manzana" } });
    lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
    cinnamon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Canela" } });
  });
  describe("getDailyRanking", () => {
    it("should order users by points", async () => {
      // User2: good guess on name, wrong type (740 points) => 180 name + 180 person + 0 type + 180 ingredients + 200 time
      await createTeaGuess(user2.id, day1.id, { teaName: "Ruta desierto", teaType: TeaType.HERBAL, ingredients: [apple.id], personName: "Deino" }, 740);
      
      // User1: perfect guess (1000 points) => 200 name + 200 person + 200 type + 200 ingredients + 200 time
      await createTeaGuess(user1.id, day1.id, { teaName: "Ruta del desierto", teaType: TeaType.ROOIBOS, ingredients: [apple.id, lemon.id], personName: "Deinos" }, 1000);

      // User3: partial guess (580 points) => 100 name + 160 person + 200 type + 0 ingredients + 120 time
      await createTeaGuess(user3.id, day1.id, { teaName: "Desierto", teaType: TeaType.ROOIBOS, ingredients: [], personName: "David" }, 580);

      const ranking = await getDailyRanking(day1.id);

      expect(ranking[0].points).toBe(1000);
      expect(ranking[1].points).toBe(740);
      expect(ranking[2].points).toBe(580);
    });

    it("should break ties base on who guessed EARLIER", async () => {
      // User3: 780 points => 160 name + 200 person + 200 type + 20 ingredients + 200 time
      const guess1 = await createTeaGuess(user3.id, day2.id, { teaName: "Té especial", teaType: TeaType.OOLONG, ingredients: [], personName: "Sony" }, 780);
      
      // User2: 780 points => 140 name + 40 person + 200 type + 200 ingredients + 200 time
      const guess2 = await createTeaGuess(user2.id, day2.id, { teaName: "Especial", teaType: TeaType.OOLONG, ingredients: [], personName: "miko" }, 780);
      
      // User1: lower score (390 points) => 90 name + 0 person + 100 type + 0 ingredients + 200 time
      const guess3 = await createTeaGuess(user1.id, day2.id, { teaName: "Oolong", teaType: TeaType.BLACK, ingredients: [] }, 390);
      
      const date = new Date();
      await Promise.all([
        prisma.teaGuess.update({ where: { id: guess1!.id }, data: { createdAt: date } }),
        prisma.teaGuess.update({ where: { id: guess2!.id }, data: { createdAt: new Date(date.getTime() + 5000) } }),
        prisma.teaGuess.update({ where: { id: guess3!.id }, data: { createdAt: new Date(date.getTime() + 10000) } }),
      ]);

      const ranking = await getDailyRanking(day2.id);

      expect(ranking[0].points).toBe(780);
      expect(ranking[0].userId).toBe(user3.id);
      expect(ranking[1].points).toBe(780);
      expect(ranking[1].userId).toBe(user2.id);
      expect(ranking[2].points).toBe(390);
      expect(ranking[2].userId).toBe(user1.id);
    });

    it("should only count the LAST guess of a user for that day", async () => {
      // User1: good guess (410 points) => 160 name + 0 person + 0 type + 200 ingredients + 50 time
      const guess1 = await createTeaGuess(user1.id, day2.id, { teaName: "Pakistaní", teaType: TeaType.GREEN, ingredients: [] }, 410);
      
      // User2: moderate guess (446 points) => 80 name + 0 person + 200 type + 66 ingredients + 100 time
      await createTeaGuess(user2.id, day2.id, { teaName: "Chai", teaType: TeaType.BLACK, ingredients: [cinnamon.id] }, 446);
      
      // User1: better guess (656 points) => 160 name + 180 person + 200 type + 66 ingredients + 50 time
      const guess2 = await createTeaGuess(user1.id, day2.id, { teaName: "Pakistani", teaType: TeaType.BLACK, ingredients: [cinnamon.id], personName: "Ñita" }, 656);
      
      // User1: Best guess (716 points) => 200 name + 200 person + 200 type + 66 ingredients + 50 time
      const guess3 = await createTeaGuess(user1.id, day2.id, { teaName: "Té pakistaní", teaType: TeaType.BLACK, ingredients: [cinnamon.id], personName: "Anónimo" }, 716);

      const date = new Date();
      await Promise.all([
        prisma.teaGuess.update({ where: { id: guess1!.id }, data: { createdAt: date } }),
        prisma.teaGuess.update({ where: { id: guess2!.id }, data: { createdAt: new Date(date.getTime() + 5000) } }),
        prisma.teaGuess.update({ where: { id: guess3!.id }, data: { createdAt: new Date(date.getTime() + 10000) } }),
      ]);

      const ranking = await getDailyRanking(day2.id);

      expect(ranking[0].points).toBe(716);
      expect(ranking[0].userId).toBe(user1.id);
      expect(ranking[1].points).toBe(446);
      expect(ranking[1].userId).toBe(user2.id);
    });
  });
});
