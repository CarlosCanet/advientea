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
  beforeSendSpan: (span) => toScrubbedGuestEvent(span),

  dsn: SENTRY_DSN,
  // Staging reports its errors too, so a regression shows up before the release.
  enabled: isProduction || VERCEL_ENV === "preview",

  // The browser's events come in through src/app/monitoring/route.ts, which forwards only the envelope and only for
  // this DSN. intercept: false, because on Vercel the SDK's own node:http hook keeps the function open until it times
  // out; the path keeps those requests out of the traces.
  integrations: [Sentry.serveTunnelIntegration({ intercept: false, path: "/monitoring" })],

  // Staging sends errors only: no traces.
  tracesSampleRate: isProduction ? 0.1 : 0,

  environment: VERCEL_ENV || process.env.NODE_ENV,

  // The user is set by hand (id and username, never the email) where the session is read; nothing else personal
  // leaves the server: no cookies, no bodies, only two request headers, and no query parameters or rows (a guest's
  // token is one).
  dataCollection: {
    cookies: false,
    databaseQueryData: false,
    httpBodies: [],
    httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
    urlQueryParams: true,
    userInfo: false,
  },
});
