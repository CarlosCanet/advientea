// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { toScrubbedGuestEvent } from "./lib/sentry-scrub";

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

  // Same-origin, past ad-blockers, to src/app/monitoring/route.ts; the proxy's matcher leaves this path alone. The
  // cookies go with it on purpose: Vercel Deployment Protection lets no preview request through without its own, and
  // the route forwards only the envelope.
  transportOptions: { fetchOptions: { credentials: "same-origin" } },
  tunnel: "/monitoring",

  // Errors only, everywhere: no traces, so the tunnel (one Vercel function call per envelope) runs only for errors.
  // Staging also skips replays.
  integrations: isProduction ? [Sentry.replayIntegration()] : [],
  tracesSampleRate: 0,

  environment: VERCEL_ENV || process.env.NODE_ENV,

  // A replay only when an error occurs, never of a whole session.
  replaysOnErrorSampleRate: isProduction ? 1.0 : 0,
  replaysSessionSampleRate: 0,

  // The user is set by SentryUser (id and username, never the email); nothing else personal is collected.
  dataCollection: {
    cookies: false,
    httpBodies: [],
    httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
    urlQueryParams: true,
    userInfo: false,
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
