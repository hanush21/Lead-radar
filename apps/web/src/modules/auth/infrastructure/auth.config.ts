import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config.
 * NO Prisma, NO Node.js-only dependencies.
 * Used by middleware for JWT verification only.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  // NextAuth v5 lee AUTH_SECRET automáticamente (fallback a NEXTAUTH_SECRET).
  // No forzar ninguno explícitamente para evitar conflictos entre ambos env vars.
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");

      if (isLoggedIn) {
        // Redirect authenticated users away from auth pages and root
        if (isAuthPage || pathname === "/") {
          return Response.redirect(new URL("/search", nextUrl));
        }
        return true;
      }

      // Unauthenticated: allow auth pages, block everything else
      if (isAuthPage) return true;
      return false; // NextAuth will redirect to signIn page automatically
    },
  },
} satisfies NextAuthConfig;
