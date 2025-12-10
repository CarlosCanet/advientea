import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

describe("Database seed verification", () => {
  it("should populate the initial required state", async () => {
    const [userCount, dayCount, teaCount] = await Promise.all([prisma.user.count(), prisma.day.count(), prisma.tea.count()]);
    expect(userCount).toBe(5);
    expect(dayCount).toBe(25);
    expect(teaCount).toBe(2);
  });

  it("should have critical users configured", async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    const executeave = await prisma.user.findFirst({ where: { role: Role.EXECUTEAVE } });
    expect(admin).toBeDefined();
    expect(admin?.email).toBe("carlos@carlos.com");
    expect(executeave).toBeDefined();
    expect(executeave?.email).toBe("jorgedeinos@gmail.com");
  });

  it("should have relationships correctly linked", async () => {
    const day1 = await prisma.day.findUnique({
      where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
      include: {
        tea: {
          include: {
            story: {
              include: { images: { orderBy: { order: "asc" } } },
            },
          },
        },
        assignment: { include: { user: true } },
      },
    });
    expect(day1?.tea).toBeDefined();
    expect(day1?.tea?.name).toBe("Ruta del desierto");
    expect(day1?.assignment).toBeDefined();
    expect(day1?.assignment?.user?.username).toBe("Deinos");
    expect(day1?.tea);
    expect(day1?.tea?.story?.storyPart1).toBe("Todo pasó hace tiempo");
    expect(day1?.tea?.story?.youtubeURL).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
    expect(day1?.tea?.story?.images[0].publicId).toBe("samples/dessert-on-a-plate");
    expect(day1?.tea?.story?.images[2].publicId).toBe("samples/cup-on-a-table");
  });
});
