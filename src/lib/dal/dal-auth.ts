import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "../auth";
import { Role } from "@/generated/prisma/enums";
import { ForbiddenError, UnauthenticatedError } from "../errors";

export const verifySession = cache(async function verifySession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return { isAuth: false as const, userId: null, role: null };
  }
  return { isAuth: true as const, userId: session.user.id, role: session.user.role };
});

export async function requireSession(){
  const session = await verifySession();
  if (!session.isAuth) {
    throw new UnauthenticatedError();
  }
  return session;
}

export async function requireRole(...roles: Role[]){
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export async function changePassword(currentPassword: string, newPassword: string, revokeOtherSessions: boolean) {
  const data = await auth.api.changePassword({
    body: {
        newPassword,
        currentPassword,
        revokeOtherSessions,
    },
    headers: await headers(),
  });
  return !!data;
}