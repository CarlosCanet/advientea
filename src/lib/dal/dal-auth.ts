import { headers } from "next/headers";
import { cache } from "react";

import { Role } from "@/generated/prisma/enums";

import { auth } from "../auth";
import { ForbiddenError, UnauthenticatedError } from "../errors";

export const verifySession = cache(async function verifySession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return { isAuth: false as const, role: null, user: null, userId: null };
  }
  return { isAuth: true as const, role: session.user.role, user: session.user, userId: session.user.id };
});

export async function requireSession() {
  const session = await verifySession();
  if (!session.isAuth) {
    throw new UnauthenticatedError();
  }
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export async function changePassword(currentPassword: string, newPassword: string, revokeOtherSessions: boolean) {
  const data = await auth.api.changePassword({
    body: {
      currentPassword,
      newPassword,
      revokeOtherSessions,
    },
    headers: await headers(),
  });
  return !!data;
}
