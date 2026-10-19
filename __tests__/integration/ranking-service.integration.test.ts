import { beforeEach, describe, expect, it } from "vitest";

import { Day, TeaIngredient, TeaType, User } from "@/generated/prisma/client";
import { createTeaGuess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getDailyRanking, getOverallRanking } from "@/lib/services/ranking-service";

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
      await createTeaGuess(
        user2.id,
        day1.id,
        { ingredients: [apple.id], personName: "Deino", teaName: "Ruta desierto", teaType: TeaType.HERBAL },
        740,
      );

      // User1: perfect guess (1000 points) => 200 name + 200 person + 200 type + 200 ingredients + 200 time
      await createTeaGuess(
        user1.id,
        day1.id,
        {
          ingredients: [apple.id, lemon.id],
          personName: "Deinos",
          teaName: "Ruta del desierto",
          teaType: TeaType.ROOIBOS,
        },
        1000,
      );

      // User3: partial guess (580 points) => 100 name + 160 person + 200 type + 0 ingredients + 120 time
      await createTeaGuess(
        user3.id,
        day1.id,
        { ingredients: [], personName: "David", teaName: "Desierto", teaType: TeaType.ROOIBOS },
        580,
      );

      const ranking = await getDailyRanking(day1.id);

      expect(ranking).not.toBeNull();
      expect(ranking![0].points).toBe(1000);
      expect(ranking![1].points).toBe(740);
      expect(ranking![2].points).toBe(580);
    });

    it("should break ties base on who guessed EARLIER", async () => {
      // User3: 780 points => 160 name + 200 person + 200 type + 20 ingredients + 200 time
      const guess1 = await createTeaGuess(
        user3.id,
        day2.id,
        { ingredients: [], personName: "Sony", teaName: "Té especial", teaType: TeaType.OOLONG },
        780,
      );

      // User2: 780 points => 140 name + 40 person + 200 type + 200 ingredients + 200 time
      const guess2 = await createTeaGuess(
        user2.id,
        day2.id,
        { ingredients: [], personName: "miko", teaName: "Especial", teaType: TeaType.OOLONG },
        780,
      );

      // User1: lower score (390 points) => 90 name + 0 person + 100 type + 0 ingredients + 200 time
      const guess3 = await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [], teaName: "Oolong", teaType: TeaType.BLACK },
        390,
      );

      const date = new Date();
      await Promise.all([
        prisma.teaGuess.update({ data: { createdAt: date }, where: { id: guess1!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 5000) }, where: { id: guess2!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 10000) }, where: { id: guess3!.id } }),
      ]);

      const ranking = await getDailyRanking(day2.id);

      expect(ranking).not.toBeNull();
      expect(ranking![0].points).toBe(780);
      expect(ranking![0].userId).toBe(user3.id);
      expect(ranking![1].points).toBe(780);
      expect(ranking![1].userId).toBe(user2.id);
      expect(ranking![2].points).toBe(390);
      expect(ranking![2].userId).toBe(user1.id);
    });

    it("should only count the LAST guess of a user for that day", async () => {
      // User1: good guess (410 points) => 160 name + 0 person + 0 type + 200 ingredients + 50 time
      const guess1 = await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [], teaName: "Pakistaní", teaType: TeaType.GREEN },
        410,
      );

      // User2: moderate guess (446 points) => 80 name + 0 person + 200 type + 66 ingredients + 100 time
      await createTeaGuess(
        user2.id,
        day2.id,
        { ingredients: [cinnamon.id], teaName: "Chai", teaType: TeaType.BLACK },
        446,
      );

      // User1: better guess (656 points) => 160 name + 180 person + 200 type + 66 ingredients + 50 time
      const guess2 = await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [cinnamon.id], personName: "Ñita", teaName: "Pakistani", teaType: TeaType.BLACK },
        656,
      );

      // User1: Best guess (716 points) => 200 name + 200 person + 200 type + 66 ingredients + 50 time
      const guess3 = await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [cinnamon.id], personName: "Anónimo", teaName: "Té pakistaní", teaType: TeaType.BLACK },
        716,
      );

      const date = new Date();
      await Promise.all([
        prisma.teaGuess.update({ data: { createdAt: date }, where: { id: guess1!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 5000) }, where: { id: guess2!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 10000) }, where: { id: guess3!.id } }),
      ]);

      const ranking = await getDailyRanking(day2.id);

      expect(ranking).not.toBeNull();
      expect(ranking![0].points).toBe(716);
      expect(ranking![0].userId).toBe(user1.id);
      expect(ranking![1].points).toBe(446);
      expect(ranking![1].userId).toBe(user2.id);
    });
  });
  describe("getOverallRanking", () => {
    it("should order users by points", async () => {
      // User1 940 points: day1 -> 740 points, day2 -> 200 points
      await createTeaGuess(
        user1.id,
        day1.id,
        { ingredients: [apple.id], personName: "Dein", teaName: "Ruta del desierto", teaType: TeaType.ROOIBOS },
        740,
      );
      await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [apple.id, lemon.id], personName: "Deinos", teaName: "Té Pakistaní", teaType: TeaType.ROOIBOS },
        200,
      );

      // User2 1500 points: day1 -> 900 points, day2 -> 600 points
      await createTeaGuess(
        user2.id,
        day1.id,
        { ingredients: [apple.id], personName: "Deino", teaName: "Ruta desierto", teaType: TeaType.HERBAL },
        900,
      );
      await createTeaGuess(
        user2.id,
        day2.id,
        { ingredients: [apple.id], personName: "miko", teaName: "Té Pakistaní", teaType: TeaType.BLACK },
        600,
      );

      // User3 1000 points: day1-> 1000 points
      await createTeaGuess(
        user3.id,
        day1.id,
        { ingredients: [], personName: "David", teaName: "Ruta del desierto", teaType: TeaType.ROOIBOS },
        1000,
      );

      const ranking = await getOverallRanking();

      expect(ranking).not.toBeNull();
      expect(ranking![0].points).toBe(1500);
      expect(ranking![0].userId).toBe(user2.id);
      expect(ranking![1].points).toBe(1000);
      expect(ranking![1].userId).toBe(user3.id);
      expect(ranking![2].points).toBe(940);
      expect(ranking![2].userId).toBe(user1.id);
    });

    it("should only count the LAST guess of a user for every day", async () => {
      // User1 940 points: day1 -> 740 points, day2 -> 200 points
      const guess111 = await createTeaGuess(
        user1.id,
        day1.id,
        { ingredients: [apple.id], personName: "Adcc", teaName: "Té especial", teaType: TeaType.ROOIBOS },
        150,
      );
      const guess112 = await createTeaGuess(
        user1.id,
        day1.id,
        { ingredients: [apple.id], personName: "Dein", teaName: "Ruta del desierto", teaType: TeaType.ROOIBOS },
        740,
      );
      await createTeaGuess(
        user1.id,
        day2.id,
        { ingredients: [apple.id, lemon.id], personName: "Deinos", teaName: "Té Pakistaní", teaType: TeaType.ROOIBOS },
        200,
      );

      // User2 1500 points: day1 -> 900 points, day2 -> 600 points
      const guess211 = await createTeaGuess(
        user2.id,
        day1.id,
        { ingredients: [cinnamon.id], personName: "Deino", teaName: "Ascae té", teaType: TeaType.BLACK },
        300,
      );
      const guess212 = await createTeaGuess(
        user2.id,
        day1.id,
        { ingredients: [apple.id], personName: "Deino", teaName: "Ruta desierto", teaType: TeaType.HERBAL },
        900,
      );
      await createTeaGuess(
        user2.id,
        day2.id,
        { ingredients: [apple.id], personName: "miko", teaName: "Té Pakistaní", teaType: TeaType.BLACK },
        600,
      );

      const date = new Date();
      await Promise.all([
        prisma.teaGuess.update({ data: { createdAt: date }, where: { id: guess111!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 5000) }, where: { id: guess211!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 10000) }, where: { id: guess112!.id } }),
        prisma.teaGuess.update({ data: { createdAt: new Date(date.getTime() + 20000) }, where: { id: guess212!.id } }),
      ]);

      const ranking = await getOverallRanking();

      expect(ranking).not.toBeNull();
      expect(ranking![0].points).toBe(1500);
      expect(ranking![0].userId).toBe(user2.id);
      expect(ranking![1].points).toBe(940);
      expect(ranking![1].userId).toBe(user1.id);
    });
  });
});
