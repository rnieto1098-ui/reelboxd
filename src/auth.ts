import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordHit } from "@/lib/rateLimit";

const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Keyed by email, not IP — the goal is stopping credential
        // stuffing against one account regardless of which IP it comes
        // from, not IP-based throttling (which a botnet trivially evades
        // anyway). Only failed attempts count below, so a user who just
        // fumble-typed their own password a few times in a row is never
        // the one who gets locked out.
        const rateLimitKey = `login:${email.toLowerCase()}`;
        if (await isRateLimited(rateLimitKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS)) {
          // Returning null (not throwing) keeps this indistinguishable
          // from "wrong password" to the client — no signal to a would-be
          // attacker that they've been throttled.
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.hashedPassword) {
          await recordHit(rateLimitKey);
          return null;
        }

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) {
          await recordHit(rateLimitKey);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
