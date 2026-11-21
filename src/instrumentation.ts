import * as Sentry from "@sentry/nextjs";

// Only the Node.js runtime: the proxy runs on it in Next 16, and no route declares the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
