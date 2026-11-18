import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { User } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  getAllParticipations,
  getParticipationById,
  getParticipationByUserId,
  ParticipationWithDayTeaAndUser,
} from "@/lib/dal";

describe("DAL Participation", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getParticipation", () => {
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

    const mockParticipation: ParticipationWithDayTeaAndUser = {
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
      id: "participation-1",
      updatedAt: new Date(),
      user: mockUser,
      userId: "user-1",
      year: 2025,
    };

    it("should get participation by ID string", async () => {
      prismaMock.participation.findUnique.mockResolvedValue(mockParticipation);

      const result = await getParticipationById("participation-1");

      expect(result).toEqual(mockParticipation);
      expect(prismaMock.participation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "participation-1" } }),
      );
    });

    it("should return null if participation ID not found", async () => {
      prismaMock.participation.findUnique.mockResolvedValue(null);
      const result = await getParticipationById("missing-id");
      expect(result).toBeNull();
    });

    it("should get the participation of a user in a year", async () => {
      prismaMock.participation.findUnique.mockResolvedValue(mockParticipation);

      const result = await getParticipationByUserId("user-1", 2025);

      expect(result).toEqual(mockParticipation);
      expect(prismaMock.participation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_year: { userId: "user-1", year: 2025 } },
        }),
      );
    });

    it("should return null when the user has no participation that year", async () => {
      prismaMock.participation.findUnique.mockResolvedValue(null);

      expect(await getParticipationByUserId("ghost-user", 2025)).toBeNull();
    });
  });

  describe("getAllParticipations", () => {
    it("should return all participations for a year", async () => {
      const mockList: ParticipationWithDayTeaAndUser[] = [];
      prismaMock.participation.findMany.mockResolvedValue(mockList);

      const result = await getAllParticipations(2025);

      expect(result).toEqual([]);
      expect(prismaMock.participation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { year: 2025 } }),
      );
    });
  });
});
