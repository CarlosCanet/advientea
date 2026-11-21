import { NextRequest, NextResponse } from "next/server";

import { getGuestParticipationByToken } from "@/lib/dal";
import { GUEST_COOKIE, GUEST_COOKIE_PATH, guestCookieAttributes, guestCookieOptions } from "@/lib/guest-cookie";

/**
 * The guest's secret link. It trades the token in the URL for a cookie and sends the guest on to /invitado,
 * so the token leaves neither the address bar nor the history nor a Referer behind.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const participation = await getGuestParticipationByToken(token);

  const response = NextResponse.redirect(new URL(GUEST_COOKIE_PATH, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (participation) {
    response.cookies.set(GUEST_COOKIE, token, guestCookieOptions);
  } else {
    // A stale cookie from an older link would otherwise keep opening that guest's page.
    response.cookies.delete({ ...guestCookieAttributes, name: GUEST_COOKIE });
  }
  return response;
}
