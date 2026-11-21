// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { toScrubbedGuestEvent } from "./src/lib/sentry-scrub";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isProduction = VERCEL_ENV === "production";

Sentry.init({
  // No guest token reaches Sentry, whichever field carries the URL.
  beforeBreadcrumb: (breadcrumb) => toScrubbedGuestEvent(breadcrumb),
  beforeSend: (event) => toScrubbedGuestEvent(event),
  beforeSendTransaction: (event) => toScrubbedGuestEvent(event),

  dsn: SENTRY_DSN,
  // Staging reports its errors too, so a regression shows up before the release.
  enabled: isProduction || VERCEL_ENV === "preview",

  // Staging sends errors only: no traces.
  tracesSampleRate: isProduction ? 0.1 : 0,

  // Enable logs to be sent to Sentry
  enableLogs: isProduction,
  environment: VERCEL_ENV || process.env.NODE_ENV,

  // The user is set by hand (id and username, never the email) where the session is read; nothing else personal
  // leaves the server: no cookies, no bodies, and only two request headers.
  dataCollection: {
    cookies: false,
    httpBodies: [],
    httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
    urlQueryParams: true,
    userInfo: false,
  },
});
