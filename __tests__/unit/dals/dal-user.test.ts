/**
 * @jest-environment node
 */

import { prismaMock } from "../../singleton";
import { User, Role } from "@/generated/prisma/client";
import { getUser, getAllUsers, editUser, changeUserRole, deleteUser, createPrismaUser, UserWithDayAssignedDay } from "@/lib/dal/dal-user";

describe("DAL User", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  const mockUser: User = {
    id: "user-1",
    username: "TestUser",
    email: "test@example.com",
    role: "USER",
    image: null,
    name: null,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    const mockUsersList: Array<UserWithDayAssignedDay> = [
      {
        id: "1",
        username: "A",
        image: null,
        email: "a@a.com",
        role: Role.USER,
        daysAssigned: [],
      },
    ];

    it("should select sensitive fields if isAdmin is TRUE", async () => {
      prismaMock.user.findMany.mockResolvedValue(mockUsersList as unknown as Array<User>);

      await getAllUsers(true);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            email: true,
            role: true,
            id: true,
          }),
        })
      );
    });

    it("should NOT select sensitive fields if isAdmin is FALSE", async () => {
      prismaMock.user.findMany.mockResolvedValue(mockUsersList as unknown as Array<User>);

      await getAllUsers(false);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            email: false,
            role: false,
            id: true,
          }),
        })
      );
    });
  });

  describe("editUser", () => {
    it("should update user fields", async () => {
      const updatedUser: User = { ...mockUser, username: "NewName" };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const dataToUpdate = { username: "NewName", image: "new-img" };
      const result = await editUser("user-1", dataToUpdate);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: dataToUpdate,
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
        where: { id: "user-1" },
        data: { role: "ADMIN" },
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
        username: "TestUser",
        email: "test@example.com",
        password: "hashed",
        role: Role.USER,
      };

      const result = await createPrismaUser(createData);

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });
});
