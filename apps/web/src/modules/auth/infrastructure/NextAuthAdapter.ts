import NextAuth, { type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { prisma } from "@/shared/lib/prisma";
import bcrypt from "bcryptjs";
import { getConfiguredAppBaseUrl } from "@/modules/auth/infrastructure/passwordReset";
import { getAuthSecret } from "@/modules/auth/infrastructure/authEnv";

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  secret: getAuthSecret(),
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const email = String(credentials.email).trim().toLowerCase();
          const password = String(credentials.password);

          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) return null;

          const isValid = await bcrypt.compare(password, user.passwordHash);

          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Credentials authorize failed", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const appBaseUrl = getConfiguredAppBaseUrl() || baseUrl;

      if (url.startsWith("/")) {
        return `${appBaseUrl}${url}`;
      }

      try {
        const targetUrl = new URL(url);
        if (targetUrl.origin === appBaseUrl || targetUrl.origin === baseUrl) {
          return url;
        }
      } catch {
        return appBaseUrl;
      }

      return appBaseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

type BaseAuthFn = {
  (): Promise<Session | null>;
  (request: unknown): Promise<Session | null>;
};

const baseAuth = nextAuth.auth as BaseAuthFn;

export const { handlers, signIn, signOut } = nextAuth;

async function getFallbackSession(): Promise<Session | null> {
  const secret = getAuthSecret();
  if (!secret) return null;

  try {
    const headerStore = headers();
    const cookieHeader = headerStore.get("cookie") ?? "";

    const token = await getToken({
      req: {
        headers: {
          cookie: cookieHeader,
        },
      } as Parameters<typeof getToken>[0]["req"],
      secret,
    });

    const userId = typeof token?.id === "string" ? token.id : typeof token?.sub === "string" ? token.sub : null;
    if (!userId) return null;

    return {
      user: {
        id: userId,
        email: typeof token?.email === "string" ? token.email : undefined,
        name: typeof token?.name === "string" ? token.name : undefined,
      },
      expires:
        typeof token?.exp === "number"
          ? new Date(token.exp * 1000).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session;
  } catch (error) {
    console.error("Fallback session resolution failed", error);
    return null;
  }
}

export async function auth(request?: unknown): Promise<Session | null> {
  const session = typeof request === "undefined" ? await baseAuth() : await baseAuth(request);
  if (session?.user?.id) return session;
  return getFallbackSession();
}
