import { describe, expect, it } from 'vitest'
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

describe("Integration test test", () => {
  it("should have 1 admin and 5 users", async () => {
    const users = await prisma.user.findMany();
    const adminUsers = await prisma.user.findMany({ where: { role: Role.ADMIN } });
    const execUsers = await prisma.user.findMany({ where: { role: Role.EXECUTEAVE } });
    expect(users.length).toBe(5);
    expect(adminUsers.length).toBe(1);
    expect(execUsers.length).toBe(1);
    expect(adminUsers[0].username).toBe("CarlosC");
    expect(adminUsers[0].email).toBe("carlos@carlos.com");
    expect(adminUsers[0].image).toBe("38_kjq3k8");
    expect(execUsers[0].username).toBe("Deinos");
    expect(execUsers[0].email).toBe("jorgedeinos@gmail.com");
    expect(execUsers[0].image).toBe("94_dtpyjy");
  })
});