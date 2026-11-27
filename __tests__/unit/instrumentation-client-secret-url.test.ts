import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toScrubbedEvent, toScrubbedUrl } from "@/lib/sentry-scrub";

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
const SECRET_PAGE_URLS = [RESET_URL, "https://adviente.vercel.app/invitado/xyz"];
const PLAIN_PAGE_URLS = [
  "https://adviente.vercel.app/reset-password",
  "https://adviente.vercel.app/teaDay/3?x=1",
  "https://adviente.vercel.app/reset-password?error=INVALID_TOKEN",
];

/** Loads the browser config afresh on a page at `href` (no `location` at all when undefined), and returns what it handed to Sentry.init. */
async function loadOnPage(vercelEnv: string | undefined, href: string | undefined): Promise<InitOptions> {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", vercelEnv);
  vi.stubGlobal("location", href === undefined ? undefined : { href });
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
  vi.unstubAllGlobals();
});

describe("the page URLs used here", () => {
  it.each(SECRET_PAGE_URLS)("%s carries a secret", (href) => {
    expect(toScrubbedUrl(href)).not.toBe(href);
  });

  it.each(PLAIN_PAGE_URLS)("%s carries no secret", (href) => {
    expect(toScrubbedUrl(href)).toBe(href);
  });
});

describe.each(SECRET_PAGE_URLS)("instrumentation-client in production loaded on %s", (href) => {
  it("does not set up the replay integration", async () => {
    const options = await loadOnPage("production", href);

    expect(replayIntegration).not.toHaveBeenCalled();
    expect(toIntegrations(options).some(isReplayMarker)).toBe(false);
  });

  it("still adds an integration whose processEvent scrubs the event", async () => {
    const options = await loadOnPage("production", href);
    const integration = findProcessEventIntegration(options);
    const event = { request: { url: RESET_URL }, transaction: "GET /invitado/xyz" };

    const result = await integration.processEvent?.(event, {}, {});

    expect(result).toEqual(toScrubbedEvent(event));
    expect(result).toEqual({ request: { url: SCRUBBED_RESET_URL }, transaction: "GET /invitado/[token]" });
  });

  it("still scrubs the event in beforeSend", async () => {
    const options = await loadOnPage("production", href);
    const event = { request: { url: RESET_URL } };

    const result = (await options.beforeSend?.(event, {})) as null | typeof event | undefined;

    expect(result?.request.url).toBe(SCRUBBED_RESET_URL);
  });

  it("still scrubs the breadcrumb in beforeBreadcrumb", async () => {
    const options = await loadOnPage("production", href);
    const breadcrumb = { category: "navigation", data: { from: "/sign-in", to: "/invitado/xyz" } };

    const result = options.beforeBreadcrumb?.(breadcrumb, {}) as null | typeof breadcrumb | undefined;

    expect(result?.data.to).toBe("/invitado/[token]");
  });

  it("still scrubs the span in beforeSendSpan", async () => {
    const options = await loadOnPage("production", href);
    const span = { data: { "url.full": RESET_URL }, description: "GET /invitado/xyz" };

    const result = options.beforeSendSpan?.(span) as null | typeof span | undefined;

    expect(result?.data["url.full"]).toBe(SCRUBBED_RESET_URL);
    expect(result?.description).toBe("GET /invitado/[token]");
  });
});

describe.each(PLAIN_PAGE_URLS)("instrumentation-client in production loaded on %s", (href) => {
  it("sets up the replay integration", async () => {
    const options = await loadOnPage("production", href);

    expect(replayIntegration).toHaveBeenCalled();
    expect(toIntegrations(options).some(isReplayMarker)).toBe(true);
  });

  it("still adds the scrubbing processEvent integration", async () => {
    const options = await loadOnPage("production", href);

    expect(() => findProcessEventIntegration(options)).not.toThrow();
  });
});

describe("instrumentation-client in production without a location", () => {
  it("sets up the replay integration", async () => {
    const options = await loadOnPage("production", undefined);

    expect(replayIntegration).toHaveBeenCalled();
    expect(toIntegrations(options).some(isReplayMarker)).toBe(true);
  });
});
