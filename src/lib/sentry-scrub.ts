// A guest's secret token travels in the path of their link, /invitado/<token>, where no query-param filter sees it.
const GUEST_LINK_PATH = /\/invitado\/(?!\[token\])[^/?#\s"'<>]+/g;

/** The URL with any guest token replaced by a placeholder. */
export function toScrubbedGuestUrl(url: string): string {
  return url.replace(GUEST_LINK_PATH, "/invitado/[token]");
}

/**
 * The value with every string in it scrubbed, however deep: request URLs, transaction names, span attributes
 * and breadcrumbs all carry the path under different keys.
 */
export function toScrubbedGuestEvent<T>(value: T): T {
  if (typeof value === "string") {
    return toScrubbedGuestUrl(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toScrubbedGuestEvent(item)) as T;
  }
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toScrubbedGuestEvent(item)])) as T;
  }
  return value;
}
