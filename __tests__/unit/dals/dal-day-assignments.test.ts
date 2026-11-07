import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  DayAssignmentWithDayTeaAndUser,
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
});
