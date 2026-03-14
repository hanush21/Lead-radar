import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/modules/auth/infrastructure/authEnv";

const AUTH_CALLBACK_COOKIE_NAMES = [
  "__Secure-authjs.callback-url",
  "authjs.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.callback-url",
] as const;

function normalizeCallbackUrl(value: string | undefined, request: NextRequest): string | null {
  if (!value) return null;

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  const currentHost = request.nextUrl.host;
  if (value.startsWith(`${currentHost}/`)) {
    return `/${value.slice(currentHost.length + 1)}`;
  }

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.origin !== request.nextUrl.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function sanitizeAuthCallbackCookies(request: NextRequest, response: NextResponse) {
  for (const cookieName of AUTH_CALLBACK_COOKIE_NAMES) {
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (!cookieValue) continue;

    const normalizedValue = normalizeCallbackUrl(cookieValue, request);
    if (normalizedValue === cookieValue) continue;

    if (normalizedValue) {
      response.cookies.set(cookieName, normalizedValue, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: cookieName.startsWith("__Secure-") || request.nextUrl.protocol === "https:",
      });
      continue;
    }

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
  const hasAuthError = request.nextUrl.searchParams.has("error");
  const forceAuthView = request.nextUrl.searchParams.get("force") === "1";
  const rawCallbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const normalizedCallbackUrl = normalizeCallbackUrl(rawCallbackUrl ?? undefined, request);
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
  });

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (rawCallbackUrl && rawCallbackUrl !== normalizedCallbackUrl) {
    const sanitizedUrl = request.nextUrl.clone();
    if (normalizedCallbackUrl) {
      sanitizedUrl.searchParams.set("callbackUrl", normalizedCallbackUrl);
    } else {
      sanitizedUrl.searchParams.delete("callbackUrl");
    }

    const response = NextResponse.redirect(sanitizedUrl);
    sanitizeAuthCallbackCookies(request, response);
    return response;
  }

  if (token) {
    // Authenticated users should not stay in auth forms or home splash.
    if ((isAuthPage && !hasAuthError && !forceAuthView) || pathname === "/") {
      const response = NextResponse.redirect(new URL("/search", request.url));
      sanitizeAuthCallbackCookies(request, response);
      return response;
    }
    const response = NextResponse.next();
    sanitizeAuthCallbackCookies(request, response);
    return response;
  }

  if (!token) {
    if (isAuthPage) {
      const response = NextResponse.next();
      sanitizeAuthCallbackCookies(request, response);
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    const callbackUrl = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    const response = NextResponse.redirect(loginUrl);
    sanitizeAuthCallbackCookies(request, response);
    return response;
  }

  const response = NextResponse.next();
  sanitizeAuthCallbackCookies(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
