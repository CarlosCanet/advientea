import { beforeAll, describe, expect, it, vi } from "vitest";

import { Role, User } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  changeUserRole,
  createPrismaUser,
  deleteUser,
  editUser,
  getAllUsers,
  getUser,
  getUsersBasic,
  UserForManagement,
} from "@/lib/dal/dal-user";

describe("DAL User", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const mockUser: User = {
    createdAt: new Date(),
    email: "test@example.com",
    emailVerified: false,
    id: "user-1",
    image: null,
    name: null,
    role: "USER",
    updatedAt: new Date(),
    username: "TestUser",
  };

  describe("getUser", () => {
    it("should return user if found by email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUser("test@example.com");

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("should throw error if user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(getUser("missing@example.com")).rejects.toThrow("The user doesn't exist.");
    });
  });

  describe("getAllUsers", () => {
    const mockUsersList: Array<UserForManagement> = [
      {
        daysAssigned: [],
        email: "a@a.com",
        id: "1",
        image: null,
        role: Role.USER,
        username: "A",
      },
    ];

    it("selects email and role for the managers' user page", async () => {
      prismaMock.user.findMany.mockResolvedValue(mockUsersList as unknown as Array<User>);

      await getAllUsers();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ email: true, id: true, role: true }),
        }),
      );
    });
  });

  describe("getUsersBasic", () => {
    it("selects only id and username, ordered by username", async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: "1", username: "A" }] as unknown as Array<User>);

      const result = await getUsersBasic();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        orderBy: { username: "asc" },
        select: { id: true, username: true },
      });
      expect(result).toEqual([{ id: "1", username: "A" }]);
    });
  });

  describe("editUser", () => {
    it("should update user fields", async () => {
      const updatedUser: User = { ...mockUser, username: "NewName" };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const dataToUpdate = { image: "new-img", username: "NewName" };
      const result = await editUser("user-1", dataToUpdate);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        data: dataToUpdate,
        where: { id: "user-1" },
      });
    });
  });

  // --- TEST: changeUserRole ---
  describe("changeUserRole", () => {
    it("should update only the role", async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      prismaMock.user.update.mockResolvedValue(adminUser);

      const result = await changeUserRole("user-1", "ADMIN");

      expect(result.role).toBe("ADMIN");
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        data: { role: "ADMIN" },
        where: { id: "user-1" },
      });
    });
  });

  // --- TEST: deleteUser ---
  describe("deleteUser", () => {
    it("should delete user by ID", async () => {
      prismaMock.user.delete.mockResolvedValue(mockUser);

      const result = await deleteUser("user-1");

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
    });
  });

  // --- TEST: createPrismaUser ---
  describe("createPrismaUser", () => {
    it("should create user directly via Prisma", async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);

      const createData = {
        email: "test@example.com",
        password: "hashed",
        role: Role.USER,
        username: "TestUser",
      };

      const result = await createPrismaUser(createData);

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });
});
