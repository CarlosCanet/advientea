import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Day, Prisma, User } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  addDayAssignment,
  DayAssignmentWithDayAndUser,
  DayAssignmentWithDayTeaAndUser,
  deleteDayAssignment,
  editDayAssignment,
  getAllDayAssignment,
  getDayAssignmentById,
  getDayAssignmentByUserId,
} from "@/lib/dal/dal-day-assignment";

describe("DAL DayAssignment", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDayAssignment", () => {
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

    const mockAssignment: DayAssignmentWithDayTeaAndUser = {
      createdAt: new Date(),
      day: {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-1",
        tea: null,
        updatedAt: new Date(),
        year: 2025,
      },
      dayId: "day-1",
      guestName: null,
      guestToken: null,
      id: "assignment-1",
      updatedAt: new Date(),
      user: mockUser,
      userId: "user-1",
      year: 2025,
    };

    it("should get assignment by ID string", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await getDayAssignmentById("assignment-1");

      expect(result).toEqual(mockAssignment);
      expect(prismaMock.dayAssignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "assignment-1" } }),
      );
    });

    it("should return null if assignment ID not found", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(null);
      const result = await getDayAssignmentById("missing-id");
      expect(result).toBeNull();
    });

    it("should get the assignment of a user in a year", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await getDayAssignmentByUserId("user-1", 2025);

      expect(result).toEqual(mockAssignment);
      expect(prismaMock.dayAssignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_year: { userId: "user-1", year: 2025 } },
        }),
      );
    });

    it("should return null when the user has no assignment that year", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(null);

      expect(await getDayAssignmentByUserId("ghost-user", 2025)).toBeNull();
    });
  });

  describe("getAllDayAssignment", () => {
    it("should return all assignments for a year", async () => {
      const mockList: DayAssignmentWithDayTeaAndUser[] = [];
      prismaMock.dayAssignment.findMany.mockResolvedValue(mockList);

      const result = await getAllDayAssignment(2025);

      expect(result).toEqual([]);
      expect(prismaMock.dayAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year: 2025 } }),
      );
    });
  });

  describe("addDayAssignment", () => {
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

    const mockDay: Day = {
      createdAt: new Date(),
      dayNumber: 5,
      id: "day-5",
      updatedAt: new Date(),
      year: 2025,
    };

    const mockAssignmentWithUser: DayAssignmentWithDayAndUser = {
      createdAt: new Date(),
      day: mockDay,
      dayId: "day-5",
      guestName: null,
      guestToken: null,
      id: "user-id",
      updatedAt: new Date(),
      user: mockUser,
      userId: "user-1",
      year: 2025,
    };

    const mockAssignmentWithGuest: DayAssignmentWithDayAndUser = {
      createdAt: new Date(),
      day: mockDay,
      dayId: "day-5",
      guestName: "Guest",
      guestToken: null,
      id: "user-id-2",
      updatedAt: new Date(),
      user: null,
      userId: null,
      year: 2025,
    };

    it("should create assignment successfully with id", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithUser);

      const result = await addDayAssignment({ userId: "user-id" }, { dayNumber: 5, year: 2025 });

      expect(result).toEqual(mockAssignmentWithUser);
      expect(prismaMock.dayAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            day: { connect: { id: "day-5" } },
            edition: { connect: { year: 2025 } },
            user: { connect: { id: "user-id" } },
          }),
        }),
      );
    });

    it("looks the day up in the given year", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithUser);

      await addDayAssignment({ userId: "user-id" }, { dayNumber: 5, year: 2025 });

      expect(prismaMock.day.findUnique).toHaveBeenCalledWith({
        where: { dayNumber_year: { dayNumber: 5, year: 2025 } },
      });
    });

    it("should create assignment successfully with guest user", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithGuest);

      const result = await addDayAssignment({ guestName: "Guest" }, { dayNumber: 5, year: 2025 });

      expect(result).toEqual(mockAssignmentWithGuest);
      expect(prismaMock.dayAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            day: { connect: { id: "day-5" } },
            edition: { connect: { year: 2025 } },
            guestName: "Guest",
          }),
        }),
      );
    });

    it("should throw if day does not exist", async () => {
      prismaMock.day.findUnique.mockResolvedValue(null);

      await expect(addDayAssignment({ userId: "user-id" }, { dayNumber: 99, year: 2025 })).rejects.toThrow(
        "The day 99/2025 does not exist yet",
      );
    });

    it("should throw if user does not exist", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      const p2025Error = new Prisma.PrismaClientKnownRequestError("Record not found", {
        clientVersion: "1",
        code: "P2025",
      });
      prismaMock.dayAssignment.create.mockRejectedValue(p2025Error);

      await expect(addDayAssignment({ userId: "wrong-id" }, { dayNumber: 5, year: 2025 })).rejects.toThrow(
        "Record not found",
      );
    });

    it("should re-throw error on P2002 violation", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint violation", {
        clientVersion: "1",
        code: "P2002",
      });

      prismaMock.dayAssignment.create.mockRejectedValue(p2002Error);

      await expect(addDayAssignment({ userId: "user-id" }, { dayNumber: 5, year: 2025 })).rejects.toThrow(
        "Unique constraint violation",
      );
    });
  });

  describe("editDayAssignment", () => {
    it("should update assignment", async () => {
      const mockUpdated: DayAssignmentWithDayAndUser = {
        createdAt: new Date(),
        day: { id: "day-1" } as Day,
        dayId: "day-1",
        guestName: "Guest",
        guestToken: null,
        id: "assign-1",
        updatedAt: new Date(),
        user: { id: "user-1" } as User,
        userId: "user-1",
        year: 2025,
      };

      prismaMock.dayAssignment.update.mockResolvedValue(mockUpdated);

      const result = await editDayAssignment({ guestName: "Guest" }, "assign-1");

      expect(result.guestName).toBe("Guest");
    });
  });

  describe("deleteDayAssignment", () => {
    it("should delete assignment", async () => {
      const mockDeleted: DayAssignmentWithDayAndUser = {
        createdAt: new Date(),
        day: { id: "day-1" } as Day,
        dayId: "day-1",
        guestName: null,
        guestToken: null,
        id: "assign-1",
        updatedAt: new Date(),
        user: { id: "user-1" } as User,
        userId: "user-1",
        year: 2025,
      };

      prismaMock.dayAssignment.delete.mockResolvedValue(mockDeleted);

      const result = await deleteDayAssignment("assign-1");

      expect(result.id).toBe("assign-1");
    });
  });
});
