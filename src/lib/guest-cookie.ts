// Carries a guest's secret token from their link to /invitado, so that the token never stays in the address bar.
export const GUEST_COOKIE = "advientea-guest";

// Scoped to /invitado: the page and its Server Action are the only readers, and no other request carries it.
export const GUEST_COOKIE_PATH = "/invitado";

const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

// Without maxAge: deleting the cookie sends these same attributes, and a Max-Age there would outlive the expiry.
export const guestCookieAttributes = {
  httpOnly: true,
  path: GUEST_COOKIE_PATH,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;

export const guestCookieOptions = { ...guestCookieAttributes, maxAge: GUEST_COOKIE_MAX_AGE } as const;
