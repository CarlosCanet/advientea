import { describe, expect, it } from "vitest";

import { Role } from "@/generated/prisma/enums";
import { getAllUsers } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// The seed creates five users, in this order: CarlosC (admin), Deinos (manager), mikoalilla, Ñita and Sony.
// All but the admin are enrolled in 2025.
const USER_KEYS = ["email", "id", "image", "role", "username"];

describe("dal User", () => {
  describe("getAllUsers", () => {
    it("returns every user with exactly their email, id, image, role and username", async () => {
      const rows = await prisma.user.findMany({
        select: { email: true, id: true, image: true, role: true, username: true },
      });

      const users = await getAllUsers();

      expect(users).toHaveLength(5);
      for (const user of users) {
        expect(Object.keys(user).toSorted()).toEqual(USER_KEYS);
        expect(user).toEqual(rows.find((row) => row.id === user.id));
      }
      expect(users.find((user) => user.username === "Deinos")).toEqual({
        email: "gerente@example.com",
        id: expect.any(String),
        image: "94_dtpyjy",
        role: Role.EXECUTEAVE,
        username: "Deinos",
      });
    });

    it("carries no participations, for someone enrolled in an edition or not", async () => {
      const enrolled = await prisma.user.findMany({
        select: { id: true },
        where: { participations: { some: {} } },
      });

      const users = await getAllUsers();

      expect(enrolled).toHaveLength(4);
      for (const user of users) {
        expect(user).not.toHaveProperty("participations");
      }
    });

    it("returns a user without an image with a null image, not without the key", async () => {
      await prisma.user.create({ data: { email: "alba@example.com", username: "Alba" } });

      const users = await getAllUsers();

      const alba = users.find((user) => user.username === "Alba");
      expect(alba).toEqual({
        email: "alba@example.com",
        id: expect.any(String),
        image: null,
        role: Role.USER,
        username: "Alba",
      });
      expect(Object.keys(alba!).toSorted()).toEqual(USER_KEYS);
    });

    it("orders them by username, whatever the order they were created in", async () => {
      // Created after the seeded five and in reverse, so neither creation order nor its reverse passes.
      // Capitalised ASCII names keep their place among the seeded ones under any database collation.
      await prisma.user.create({ data: { email: "elena@example.com", username: "Elena" } });
      await prisma.user.create({ data: { email: "alba@example.com", username: "Alba" } });
      const ordered = await prisma.user.findMany({ orderBy: { username: "asc" }, select: { username: true } });

      const users = await getAllUsers();

      const usernames = users.map((user) => user.username);
      expect(usernames).toHaveLength(7);
      expect(usernames.slice(0, 4)).toEqual(["Alba", "CarlosC", "Deinos", "Elena"]);
      // The accented and lower-case names sort differently from one collation to another: the database decides.
      expect(usernames).toEqual(ordered.map((user) => user.username));
    });
  });
});
