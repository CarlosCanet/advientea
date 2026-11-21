import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { cache } from "react";

import { Role } from "@/generated/prisma/enums";

import { auth } from "../auth";
import { ForbiddenError, UnauthenticatedError } from "../errors";

/**
 * The request's session, read once per render: the layout, the Navbar and the page share one lookup. Outside a
 * render (Server Actions, Route Handlers) React's cache does nothing and every call reads it again.
 */
export const getSession = cache(async function getSession() {
  return auth.api.getSession({ headers: await headers() });
});

export const verifySession = cache(async function verifySession() {
  const session = await getSession();
  if (!session?.user) {
    return { isAuth: false as const, role: null, user: null, userId: null };
  }
  // Sentry keeps one isolation scope per request, so this user tags only this request's errors. Never the email.
  Sentry.setUser({ id: session.user.id, username: session.user.username });
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
