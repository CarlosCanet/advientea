import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toScrubbedEvent } from "@/lib/sentry-scrub";

type ReplayOptions = { beforeAddRecordingEvent?: (event: unknown) => unknown } & Record<string, unknown>;
type ReplayMarker = { marker: typeof REPLAY_MARKER; name: string; options: ReplayOptions };
type Integration = { name?: string; processEvent?: (event: unknown, hint: unknown, client: unknown) => unknown };
type InitOptions = {
  beforeBreadcrumb?: (breadcrumb: unknown, hint?: unknown) => unknown;
  beforeSend?: (event: unknown, hint: unknown) => unknown;
  beforeSendSpan?: (span: unknown) => unknown;
  integrations?: ((defaults: Array<Integration>) => Array<Integration>) | Array<Integration>;
} & Record<string, unknown>;

const REPLAY_MARKER = "replay-integration-marker";

const { captureRouterTransitionStart, init, replayIntegration } = vi.hoisted(() => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn<(options: InitOptions) => void>(),
  replayIntegration: vi.fn((options: ReplayOptions) => ({
    marker: "replay-integration-marker" as const,
    name: "Replay",
    options,
  })),
}));

vi.mock("@sentry/nextjs", () => ({ captureRouterTransitionStart, init, replayIntegration }));

const RESET_URL = "https://adviente.vercel.app/reset-password?token=AbC123";
const SCRUBBED_RESET_URL = "https://adviente.vercel.app/reset-password?token=[token]";
const GUEST_URL = "https://adviente.vercel.app/invitado/xyz";
const SCRUBBED_GUEST_URL = "https://adviente.vercel.app/invitado/[token]";
const ENVIRONMENTS: Array<[string, string | undefined]> = [
  ["production", "production"],
  ["preview", "preview"],
  ["no environment", undefined],
];

/** Loads the browser config afresh with NEXT_PUBLIC_VERCEL_ENV set, and returns what it handed to Sentry.init. */
async function loadWithEnvironment(vercelEnv: string | undefined): Promise<InitOptions> {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", vercelEnv);
  await import("@/instrumentation-client");
  expect(init).toHaveBeenCalledOnce();
  return init.mock.calls[0][0];
}

function toIntegrations(options: InitOptions): Array<Integration> {
  const { integrations } = options;
  if (typeof integrations === "function") {
    return integrations([]);
  }
  return integrations ?? [];
}

function findProcessEventIntegration(options: InitOptions): Integration {
  const found = toIntegrations(options).find((integration) => typeof integration?.processEvent === "function");
  if (!found) {
    throw new Error("no integration with a processEvent function in Sentry.init's integrations");
  }
  return found;
}

function isReplayMarker(integration: unknown): integration is ReplayMarker {
  return (integration as ReplayMarker | undefined)?.marker === REPLAY_MARKER;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instrumentation-client in production", () => {
  it("adds the replay integration to Sentry.init", async () => {
    const options = await loadWithEnvironment("production");

    expect(replayIntegration).toHaveBeenCalled();
    expect(toIntegrations(options).some(isReplayMarker)).toBe(true);
  });

  it("scrubs every recording event before replay adds it", async () => {
    await loadWithEnvironment("production");
    const replayOptions = replayIntegration.mock.calls[0][0];
    const metaEvent = { data: { height: 1, href: RESET_URL, width: 1 }, timestamp: 1, type: 4 };

    expect(replayOptions.beforeAddRecordingEvent).toEqual(expect.any(Function));
    const result = replayOptions.beforeAddRecordingEvent?.(metaEvent);

    expect(result).toEqual(toScrubbedEvent(metaEvent));
    expect(result).toEqual({ data: { height: 1, href: SCRUBBED_RESET_URL, width: 1 }, timestamp: 1, type: 4 });
  });

  it("gives the replay integration in Sentry.init the same scrubbing options", async () => {
    const options = await loadWithEnvironment("production");
    const replay = toIntegrations(options).find(isReplayMarker);
    const metaEvent = { data: { height: 1, href: GUEST_URL, width: 1 }, timestamp: 1, type: 4 };

    expect(replay?.options.beforeAddRecordingEvent?.(metaEvent)).toEqual(toScrubbedEvent(metaEvent));
  });
});

describe.each(ENVIRONMENTS)("instrumentation-client with %s", (_label, vercelEnv) => {
  it("adds an integration whose processEvent scrubs the event", async () => {
    const options = await loadWithEnvironment(vercelEnv);
    const integration = findProcessEventIntegration(options);
    const event = { request: { url: RESET_URL }, transaction: "GET /invitado/xyz" };

    const result = await integration.processEvent?.(event, {}, {});

    expect(result).toEqual(toScrubbedEvent(event));
    expect(result).toEqual({ request: { url: SCRUBBED_RESET_URL }, transaction: "GET /invitado/[token]" });
  });

  it("scrubs the urls of a replay event in processEvent", async () => {
    const options = await loadWithEnvironment(vercelEnv);
    const integration = findProcessEventIntegration(options);
    const replayEvent = { type: "replay_event", urls: [RESET_URL, GUEST_URL] };

    const result = await integration.processEvent?.(replayEvent, {}, {});

    expect(result).toEqual(toScrubbedEvent(replayEvent));
    expect(result).toEqual({ type: "replay_event", urls: [SCRUBBED_RESET_URL, SCRUBBED_GUEST_URL] });
  });

  it("still scrubs the event in beforeSend", async () => {
    const options = await loadWithEnvironment(vercelEnv);
    const event = { request: { url: RESET_URL } };

    const result = (await options.beforeSend?.(event, {})) as null | typeof event | undefined;

    expect(result?.request.url).toBe(SCRUBBED_RESET_URL);
  });

  it("still scrubs the breadcrumb in beforeBreadcrumb", async () => {
    const options = await loadWithEnvironment(vercelEnv);
    const breadcrumb = { category: "navigation", data: { from: "/sign-in", to: "/invitado/xyz" } };

    const result = options.beforeBreadcrumb?.(breadcrumb, {}) as null | typeof breadcrumb | undefined;

    expect(result?.data.to).toBe("/invitado/[token]");
  });

  it("still scrubs the span in beforeSendSpan", async () => {
    const options = await loadWithEnvironment(vercelEnv);
    const span = { data: { "url.full": RESET_URL }, description: "GET /invitado/xyz" };

    const result = options.beforeSendSpan?.(span) as null | typeof span | undefined;

    expect(result?.data["url.full"]).toBe(SCRUBBED_RESET_URL);
    expect(result?.description).toBe("GET /invitado/[token]");
  });
});

describe.each(ENVIRONMENTS.filter(([, vercelEnv]) => vercelEnv !== "production"))(
  "instrumentation-client with %s",
  (_label, vercelEnv) => {
    it("leaves the replay integration out of Sentry.init", async () => {
      const options = await loadWithEnvironment(vercelEnv);

      expect(toIntegrations(options).some(isReplayMarker)).toBe(false);
    });
  },
);
