import { describe, expect, it } from "vitest";

import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

describe("Database seed verification", () => {
  it("should populate the initial required state", async () => {
    const [userCount, dayCount, teaCount] = await Promise.all([
      prisma.user.count(),
      prisma.day.count(),
      prisma.tea.count(),
    ]);
    expect(userCount).toBe(5);
    expect(dayCount).toBe(25);
    expect(teaCount).toBe(2);
  });

  it("should have critical users configured", async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    const executeave = await prisma.user.findFirst({ where: { role: Role.EXECUTEAVE } });
    expect(admin).toBeDefined();
    expect(admin?.email).toBe("admin@example.com");
    expect(executeave).toBeDefined();
    expect(executeave?.email).toBe("gerente@example.com");
  });

  it("should have relationships correctly linked", async () => {
    const day1 = await prisma.day.findUnique({
      include: {
        participation: {
          include: {
            tea: {
              include: {
                story: {
                  include: { images: { orderBy: { order: "asc" } } },
                },
              },
            },
            user: true,
          },
        },
      },
      where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
    });
    const tea = day1?.participation?.tea;
    expect(day1?.participation?.user?.username).toBe("Deinos");
    expect(tea?.name).toBe("Ruta del desierto");
    expect(tea?.story?.storyPart1).toBe("Todo pasó hace tiempo");
    expect(tea?.story?.youtubeURL).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
    expect(tea?.story?.images[0].publicId).toBe("samples/dessert-on-a-plate");
    expect(tea?.story?.images[2].publicId).toBe("samples/cup-on-a-table");
  });
});
