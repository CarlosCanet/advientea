import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "./generated/prisma/enums";

const PROTECTED_ROUTES: Array<string> = ["/profile", "/edit-tea-info"];
const EXECUTEAVE_ROUTES: Array<string> = [];
const ADMIN_ROUTES: Array<string> = ["/admin-dashboard", "/users"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isExecuteave = EXECUTEAVE_ROUTES.some((route) => pathname.startsWith(route));
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected || isExecuteave || isAdmin) {
    try {
      const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });
  
      if (!sessionResponse.ok) {
        const loginUrl = new URL("/sign-in", request.url);
        return NextResponse.redirect(loginUrl);
      }
  
      const sessionData = await sessionResponse.json();
      if (!sessionData || !sessionData.session || !sessionData.user) {
        const loginUrl = new URL("/sign-in", request.url);
        return NextResponse.redirect(loginUrl);
      }
      const { session, user } = sessionData;
  
      if (!session || !user) {
        const loginUrl = new URL("/sign-in", request.url);
        return NextResponse.redirect(loginUrl);
      }
  
      // Verify route permissions
      if (isExecuteave && user.role === Role.USER) {
        return NextResponse.rewrite(new URL("/", request.url));
      }
      if (isAdmin && user.role !== Role.ADMIN) {
        return NextResponse.rewrite(new URL("/", request.url));
      }
  
      return NextResponse.next();
    } catch (error) {
      console.error("Middleware error:", error);
      const loginUrl = new URL("/sign-in", request.url);
      return NextResponse.rewrite(loginUrl);
    }
  }
  return NextResponse.next();
}

// Configurar qué rutas debe procesar el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public routes defined above
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
