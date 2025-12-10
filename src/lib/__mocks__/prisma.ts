import { PrismaClient } from "@/generated/prisma/client";
import { beforeEach, vi } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { prisma } from "../prisma";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
// export const prismaMock = mockDeep<PrismaClient>();
