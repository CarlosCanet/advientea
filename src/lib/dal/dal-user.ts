import { Prisma, Role, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type UserBasic = Prisma.UserGetPayload<{ select: { id: true; username: true } }>;
type UserBase = Prisma.UserGetPayload<{ select: { id: true; username: true; image: true; daysAssigned: { include: { day: true } } } }>;
type SafeUser = UserBase & { email?: string | null; role?: Role };
export type UserWithDayAssignedDay = Prisma.UserGetPayload<{
  select: { id: true; username: true; image: true; email: true; role: true; daysAssigned: { include: { day: true } } };
}>;

export async function getUser(email: string): Promise<User> {
  const data = await prisma.user.findUnique({ where: { email } });
  if (!data) {
    throw new Error("The user doesn't exist.");
  }
  return data;
}

export async function getAllUsers(isAdmin: boolean): Promise<Array<UserWithDayAssignedDay>> {
  const data = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: { id: true, username: true, image: true, email: isAdmin, role: isAdmin, daysAssigned: { include: { day: true } } },
  });
  return data;
}

export async function editUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  const updated = await prisma.user.update({
    where: { id },
    data: data,
  });
  return updated;
}

export async function changeUserRole(id: string, role: Role): Promise<User> {
  const result = await prisma.user.update({
    where: { id },
    data: { role },
  });
  return result;
}

export async function deleteUser(id: string): Promise<User> {
  const deleted = await prisma.user.delete({ where: { id } });
  return deleted;
}

export async function createPrismaUser(data: Prisma.UserCreateInput): Promise<User> {
  return await prisma.user.create({ data });
}
