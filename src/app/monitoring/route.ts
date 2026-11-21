// Sentry's tunnel for the browser SDK. It forwards the envelope with the user agent, origin and client IP that Sentry
// reads, never the cookies, and refuses any DSN other than the server's own. The proxy's matcher excludes this path,
// so it answers without a session.
export { POST } from "@sentry/nextjs/tunnel";
