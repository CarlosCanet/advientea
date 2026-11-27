// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { toScrubbedEvent, toScrubbedUrl } from "./lib/sentry-scrub";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isProduction = VERCEL_ENV === "production";
// Replay records the page URL where no hook can rewrite it (rrweb's Meta event skips beforeAddRecordingEvent), so a
// page loaded with a secret in its URL, such as /reset-password?token=…, is never recorded.
const pageUrl = globalThis.location?.href ?? "";
const isPageUrlSecret = toScrubbedUrl(pageUrl) !== pageUrl;

Sentry.init({
  // No secret token (a guest link, a password reset) reaches Sentry, whichever field carries the URL.
  beforeBreadcrumb: (breadcrumb) => toScrubbedEvent(breadcrumb),
  beforeSend: (event) => toScrubbedEvent(event),
  beforeSendSpan: (span) => toScrubbedEvent(span),

  dsn: SENTRY_DSN,
  // Staging reports its errors too, so a regression shows up before the release.
  enabled: isProduction || VERCEL_ENV === "preview",

  // Same-origin, past ad-blockers, to src/app/monitoring/route.ts; the proxy's matcher leaves this path alone. The
  // cookies go with it on purpose: Vercel Deployment Protection lets no preview request through without its own, and
  // the route forwards only the envelope.
  transportOptions: { fetchOptions: { credentials: "same-origin" } },
  tunnel: "/monitoring",

  // Errors only, everywhere: no traces, so the tunnel (one Vercel function call per envelope) runs only for errors.
  // Staging also skips replays. A replay passes none of the before* hooks above: its custom events (breadcrumbs, spans)
  // go through beforeAddRecordingEvent and its replay_event (with the page URLs) through the integrations' event
  // processors.
  integrations: [
    { name: "ScrubSecretTokens", processEvent: (event) => toScrubbedEvent(event) },
    ...(isProduction && !isPageUrlSecret
      ? [Sentry.replayIntegration({ beforeAddRecordingEvent: (recordingEvent) => toScrubbedEvent(recordingEvent) })]
      : []),
  ],
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
