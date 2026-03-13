import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/shared/lib/prisma";
import bcrypt from "bcryptjs";
import { getConfiguredAppBaseUrl } from "@/modules/auth/infrastructure/passwordReset";
import { getAuthSecret } from "@/modules/auth/infrastructure/authEnv";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
