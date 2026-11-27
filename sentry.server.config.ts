// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { toScrubbedEvent } from "./src/lib/sentry-scrub";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isProduction = VERCEL_ENV === "production";

Sentry.init({
  // No secret token (a guest link, a password reset) reaches Sentry, whichever field carries the URL.
  beforeBreadcrumb: (breadcrumb) => toScrubbedEvent(breadcrumb),
  beforeSend: (event) => toScrubbedEvent(event),
  beforeSendSpan: (span) => toScrubbedEvent(span),

  dsn: SENTRY_DSN,
  // Staging reports its errors too, so a regression shows up before the release.
  enabled: isProduction || VERCEL_ENV === "preview",

  // The browser's events come in through src/app/monitoring/route.ts, which forwards only the envelope and only for
  // this DSN. intercept: false, because on Vercel the SDK's own node:http hook keeps the function open until it times
  // out; the path keeps those requests out of the traces.
  integrations: [Sentry.serveTunnelIntegration({ intercept: false, path: "/monitoring" })],

  // Errors only, everywhere: tracing costs Vercel CPU on every request (Hobby has 4 h a month) and nobody reads it.
  // Raise it for a few days to investigate a slow page.
  tracesSampleRate: 0,

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
