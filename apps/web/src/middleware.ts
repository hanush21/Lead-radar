import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/modules/auth/infrastructure/authEnv";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthError = request.nextUrl.searchParams.has("error");
  const forceAuthView = request.nextUrl.searchParams.get("force") === "1";
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (token) {
    // Authenticated users should not stay in auth forms or home splash.
    if ((isAuthPage && !hasAuthError && !forceAuthView) || pathname === "/") {
      return NextResponse.redirect(new URL("/search", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    if (isAuthPage) return NextResponse.next();

    const loginUrl = new URL("/login", request.url);
    const callbackUrl = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
