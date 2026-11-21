"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface SentryUserProps {
  /** The signed-in user, or null for a visitor without a session. Never the email. */
  user: null | { id: string; username?: string };
}

/** Tags the browser's Sentry events with who is signed in, and clears it after signing out. */
export default function SentryUser({ user }: SentryUserProps) {
  const id = user?.id;
  const username = user?.username;
  useEffect(() => {
    if (id === undefined) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser(username === undefined ? { id } : { id, username });
  }, [id, username]);
  return null;
}
