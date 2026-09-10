import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordHit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/normalizeEmail";

const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// A real cost-12 hash of a throwaway string, compared against when no user
// is found so that branch costs the same as a wrong-password one.
//
// Without it, "no such account" returns as soon as the lookup misses while
// "wrong password" pays for a bcrypt compare — a difference of a few hundred
// milliseconds that's trivially measurable over the network, turning the
// login form into an account-enumeration oracle. That's the same leak the
// rate-limit branch below is already careful about, just through timing
// instead of through the response. It has to be a genuine bcrypt hash:
// compare() against a malformed one bails out immediately and would defeat
// the entire point.
const TIMING_EQUALIZER_HASH = "$2b$12$f.6A2g0pCuwuTO8j8FplT.1te3y5y8EMQP9oKqJ4h6Llthj0t134G";

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
        const rawEmail = credentials?.email;
        const password = credentials?.password;
        if (typeof rawEmail !== "string" || typeof password !== "string") {
          return null;
        }
        const email = normalizeEmail(rawEmail);

        // Keyed by email, not IP — the goal is stopping credential
        // stuffing against one account regardless of which IP it comes
        // from, not IP-based throttling (which a botnet trivially evades
        // anyway). Only failed attempts count below, so a user who just
        // fumble-typed their own password a few times in a row is never
        // the one who gets locked out.
        const rateLimitKey = `login:${email}`;
        if (await isRateLimited(rateLimitKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS)) {
          // Returning null (not throwing) keeps this indistinguishable
          // from "wrong password" to the client — no signal to a would-be
          // attacker that they've been throttled.
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.hashedPassword) {
          // Deliberately still pays the bcrypt cost — see
          // TIMING_EQUALIZER_HASH above. The result is discarded; it can
          // never match, since nothing hashes to this.
          await bcrypt.compare(password, TIMING_EQUALIZER_HASH);
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
