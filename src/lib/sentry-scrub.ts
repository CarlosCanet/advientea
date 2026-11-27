// Secret tokens travel in URLs that Sentry would otherwise record: a guest's in the path of their link
// (/invitado/<token>), the password reset's in the path of the emailed link (/api/auth/reset-password/<token>) and
// in the query of the page it redirects to (/reset-password?token=<token>). Query-param filters do not see the paths,
// and the referer header and breadcrumbs carry full URLs, so every string is rewritten instead.
const GUEST_LINK_PATH = /\/invitado\/(?!\[token\])[^/?#\s"'<>]+/g;
const RESET_LINK_PATH = /\/api\/auth\/reset-password\/(?!\[token\])[^/?#\s"'<>]+/g;
// The start of the string counts too: request.query_string carries the query without its "?".
const TOKEN_QUERY_PARAM = /((?:^|[?&])token=)(?!\[token\])[^&#\s"'<>]+/g;

/** The URL with every secret token replaced by a placeholder. */
export function toScrubbedUrl(url: string): string {
  return url
    .replace(GUEST_LINK_PATH, "/invitado/[token]")
    .replace(RESET_LINK_PATH, "/api/auth/reset-password/[token]")
    .replace(TOKEN_QUERY_PARAM, "$1[token]");
}

/**
 * The value with every string in it scrubbed, however deep: request URLs, transaction names, span attributes
 * and breadcrumbs all carry the path under different keys.
 */
export function toScrubbedEvent<T>(value: T): T {
  if (typeof value === "string") {
    return toScrubbedUrl(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toScrubbedEvent(item)) as T;
  }
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toScrubbedEvent(item)])) as T;
  }
  return value;
}
