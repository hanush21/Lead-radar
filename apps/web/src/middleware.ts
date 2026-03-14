import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_CALLBACK_COOKIE_NAMES = [
  "__Secure-authjs.callback-url",
  "authjs.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.callback-url",
] as const;

function clearAuthCallbackCookies(response: NextResponse, request: NextRequest) {
  for (const cookieName of AUTH_CALLBACK_COOKIE_NAMES) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      secure: cookieName.startsWith("__Secure-") || request.nextUrl.protocol === "https:",
    });
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (token) {
    // Authenticated users should not stay in auth forms or home splash.
    if (isAuthPage || pathname === "/") {
      const response = NextResponse.redirect(new URL("/search", request.url));
      clearAuthCallbackCookies(response, request);
      return response;
    }
    const response = NextResponse.next();
    clearAuthCallbackCookies(response, request);
    return response;
  }

  if (!token) {
    if (isAuthPage) {
      const response = NextResponse.next();
      clearAuthCallbackCookies(response, request);
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    clearAuthCallbackCookies(response, request);
    return response;
  }

  const response = NextResponse.next();
  clearAuthCallbackCookies(response, request);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
