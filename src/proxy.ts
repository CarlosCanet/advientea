import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";

// Pages anyone may open without signing in. Each one, like every page, checks on the server what it shows.
const PUBLIC_EXACT_PATHS: Array<string> = ["/"];
// Each prefix covers the path itself and everything below it, never a longer name: /timer, not /timers.
const PUBLIC_PATH_PREFIXES: Array<string> = [
  "/invitado",
  "/reset-password",
  "/sign-in",
  "/sign-up",
  "/teaDay",
  "/timer",
];

/** Whether a path is open without a session; anything not listed here needs one. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Deny by default: without a session cookie, only the public paths go through. The cookie is only checked
 * for presence, which is enough to send an anonymous visitor to sign in; each page and each Server Action
 * still checks the session itself, and the role it needs.
 */
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  // Same prefix as auth.ts; better-auth also looks for the __Secure- name it uses over HTTPS.
  if (getSessionCookie(request, { cookiePrefix: "advientea" })) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - api/auth (better-auth's own endpoints, sign-in included)
     * - _next/static, _next/image (build output and image optimization)
     * - favicon.ico
     * - monitoring (Sentry's tunnel route: client errors are reported without a session too)
     * - any path whose last segment has a file extension (assets in public/)
     */
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|monitoring(?:/|$))(?!.*\\.[A-Za-z0-9]+$).*)",
  ],
};
