/**
 * @jest-environment node
 */

import { Day, Prisma, User } from "@/generated/prisma/client";
import { prismaMock } from "../../singleton";
import { getDayAssignment, getAllDayAssignment, addDayAssignment, editDayAssignment, deleteDayAssignment, DayAssignmentWithDayTeaAndUser, DayAssignmentWithDayAndUser } from "@/lib/dal/dal-day-assignment";

describe("DAL DayAssignment", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getDayAssignment", () => {
    const mockUser: User = {
      id: "user-1",
      username: "TestUser",
      email: "test@example.com",
      role: "USER",
      image: null,
      emailVerified: false,
      name: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockAssignment: DayAssignmentWithDayTeaAndUser = {
      id: "assignment-1",
      userId: "user-1",
      guestName: null,
      dayId: "day-1",
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      day: {
        id: "day-1",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: null,
      },
    };

    it("should get assignment by ID string", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await getDayAssignment("assignment-1");

      expect(result).toEqual(mockAssignment);
      expect(prismaMock.dayAssignment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "assignment-1" } }));
    });

    it("should return null if assignment ID not found", async () => {
      prismaMock.dayAssignment.findUnique.mockResolvedValue(null);
      const result = await getDayAssignment("missing-id");
      expect(result).toBeNull();
    });

    it("should get assignment by Year and Email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await getDayAssignment(2025, "test@example.com");

      expect(result).toEqual(mockAssignment);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "test@example.com" } });
      expect(prismaMock.dayAssignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_year: { userId: "user-1", year: 2025 } },
        })
      );
    });

    it("should throw if email is missing (logic check)", async () => {
      await expect(getDayAssignment(2025, "")).rejects.toThrow("Email is mandatory when getting by year");
    });

    it("should throw if user not found by email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(getDayAssignment(2025, "ghost@example.com")).rejects.toThrow("The user with email ghost@example.com doesn't exist");
    });
  });

  describe("getAllDayAssignment", () => {
    it("should return all assignments for a year", async () => {
      const mockList: DayAssignmentWithDayTeaAndUser[] = [];
      prismaMock.dayAssignment.findMany.mockResolvedValue(mockList);

      const result = await getAllDayAssignment(2025);

      expect(result).toEqual([]);
      expect(prismaMock.dayAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { year: 2025 } }));
    });
  });

  describe("addDayAssignment", () => {
    const mockUser: User = {
      id: "user-1",
      username: "TestUser",
      email: "test@example.com",
      role: "USER",
      image: null,
      emailVerified: false,
      name: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDay: Day = {
      id: "day-5",
      dayNumber: 5,
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockAssignmentWithUser: DayAssignmentWithDayAndUser = {
      id: "user-id",
      userId: "user-1",
      guestName: null,
      dayId: "day-5",
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      day: mockDay,
    };

    const mockAssignmentWithGuest: DayAssignmentWithDayAndUser = {
      id: "user-id-2",
      userId: null,
      guestName: "Guest",
      dayId: "day-5",
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: null,
      day: mockDay,
    }


    it("should create assignment successfully with id", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithUser);

      const result = await addDayAssignment({ userId: "user-id" }, 5, 2025);

      expect(result).toEqual(mockAssignmentWithUser);
      expect(prismaMock.dayAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            day: { connect: { id: "day-5" } },
            user: { connect: { id: "user-id" } },
            year: 2025,
          }),
        })
      );
    });

    it("should use default year 2025 when not provided", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithUser);

      await addDayAssignment({ userId: "user-id" }, 5);

      expect(prismaMock.day.findUnique).toHaveBeenCalledWith({
        where: { dayNumber_year: { dayNumber: 5, year: 2025 } },
      });
    });

    it("should create assignment successfully with guest user", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.dayAssignment.create.mockResolvedValue(mockAssignmentWithGuest);

      const result = await addDayAssignment({ guestName: "Guest" }, 5, 2025);

      expect(result).toEqual(mockAssignmentWithGuest);
      expect(prismaMock.dayAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            day: { connect: { id: "day-5" } },
            guestName: "Guest",
            year: 2025,
          }),
        })
      );
    });

    it("should throw if day does not exist", async () => {
      prismaMock.day.findUnique.mockResolvedValue(null);

      await expect(addDayAssignment({ userId: "user-id" }, 99)).rejects.toThrow("The day 99/2025 does not exist yet");
    });

    it("should throw if user does not exist", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        "Record not found",
        { code: "P2025", clientVersion: "1" }
      );
      prismaMock.dayAssignment.create.mockRejectedValue(p2025Error);

      await expect(addDayAssignment({ userId: "wrong-id" }, 5)).rejects.toThrow("Record not found");
    });

    it("should re-throw error on P2002 violation", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint violation", { code: "P2002", clientVersion: "1" });

      prismaMock.dayAssignment.create.mockRejectedValue(p2002Error);

      await expect(addDayAssignment({ userId: "user-id" }, 5)).rejects.toThrow("Unique constraint violation");
    });
  });

  describe("editDayAssignment", () => {
    it("should update assignment", async () => {
      const mockUpdated: DayAssignmentWithDayAndUser = {
        id: "assign-1",
        userId: "user-1",
        guestName: "Guest",
        dayId: "day-1",
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user-1" } as User,
        day: { id: "day-1" } as Day,
      };

      prismaMock.dayAssignment.update.mockResolvedValue(mockUpdated);

      const result = await editDayAssignment({ guestName: "Guest" }, "assign-1");

      expect(result.guestName).toBe("Guest");
    });
  });

  describe("deleteDayAssignment", () => {
    it("should delete assignment", async () => {
      const mockDeleted: DayAssignmentWithDayAndUser = {
        id: "assign-1",
        userId: "user-1",
        guestName: null,
        dayId: "day-1",
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user-1" } as User,
        day: { id: "day-1" } as Day,
      };

      prismaMock.dayAssignment.delete.mockResolvedValue(mockDeleted);

      const result = await deleteDayAssignment("assign-1");

      expect(result.id).toBe("assign-1");
    });
  });
});
