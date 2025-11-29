import { cache } from "react";
import { headers } from "next/headers";

import { Prisma, Role, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "../auth";


export const verifySession = cache(async function verifySession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { isAuth: false as const, userId: null, role: null };
  }

  return { isAuth: true as const, userId: session.user.id, role: session.user.role };
});

export async function getUser(email: string): Promise<User> {
  
  try {
    const session = await verifySession();
    if (!session.isAuth || session.role === Role.USER) {
      throw new Error("You cannot get that information.");
    }
    const data = await prisma.user.findUnique({ where: { email } });
    if (!data) {
      throw new Error("The user doesn't exist.");
    }
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllUser(): Promise<Array<Prisma.UserGetPayload<{ include: { daysAssigned: { include: { day: true } } } }>>> {
  try {
    const session = await verifySession();
    if (!session.isAuth || session.role === Role.USER) {
      throw new Error("You cannot get that information.");
    }
    
    const data = await prisma.user.findMany({
      orderBy: { username: "asc" },
      include: { daysAssigned: { include: { day: true } } }
    });
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  image?: string;
  role?: Role;
}

function canAssignRole(requestedRole: Role, callerRole?: Role): boolean {
  if (requestedRole !== Role.USER && !callerRole) return false;
  if (requestedRole === Role.ADMIN || requestedRole === Role.EXECUTEAVE) {
    return callerRole === Role.ADMIN;
  }
  return true;
}

export async function createUser(data: CreateUserDTO, callerRole?: Role) {
  const targetRole = data.role ?? Role.USER;
  if (!canAssignRole(targetRole, callerRole)) {
    throw new Error("Not authorized to assign requested role");
  }

  try {
    const body = {
      name: data.username,
      username: data.username,
      email: data.email,
      password: data.password,
      callbackURL: "/profile",
      ...(data.image && { image: data.image }),
    };

    const result = await auth.api.signUpEmail({ body });
    if (!result?.user?.id) {
      throw new Error("User creation failed");
    }

    if (targetRole === Role.USER) {
      return result.user;
    }

    const updated = await prisma.user.update({
      where: { id: result.user.id },
      data: { role: targetRole },
    });
    return updated;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("User already exists");
      return null;
    }
    console.error(error);
    throw error;
  }
}

export async function editUser(data: Omit<CreateUserDTO, "password">, callerRole?: Role): Promise<Prisma.UserUpdateInput> {
  const targetRole = data.role ?? Role.USER;
  try {
    if (!canAssignRole(targetRole, callerRole)) {
      throw new Error("Not authorized to assign requested role");
    }
    const newData = {
      ...(data.username && { name: data.username, username: data.username }),
      ...(data.image && { image: data.image }),
      ...(data.role && { role: data.role }),
    };

    const updated = await prisma.user.update({
      where: { email: data.email },
      data: newData,
    });
    return updated;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      console.error("User not found.");
    }
    throw error;
  }
}

export async function changeUserRole(id: string, role: Role): Promise<User> {
  try {
    const result = await prisma.user.update({
      where: { id },
      data: { role }
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteUser(email: string, callerRole?: Role): Promise<User> {
  try {
    if (!callerRole || callerRole !== Role.ADMIN) {
      throw new Error("Not authorized to delete users");
    }
    const deleted = await prisma.user.delete({ where: { email } });
    return deleted;
  } catch (error) {
    console.error(error);
    throw error;
  }
}