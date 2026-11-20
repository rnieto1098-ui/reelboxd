import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, recordHit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/normalizeEmail";

const LOGIN_FAIL_LIMIT = 10;
// Across every network location combined, for one account.
const LOGIN_ACCOUNT_FAIL_LIMIT = 100;
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

// One lookup per page render, however many times that render asks who is
// signed in (the layout, the header and the page each do). `cache` shares
// the result within a single request and never across requests.
const getSessionAccount = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, sessionsValidFrom: true },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Stays signed in on this device for a year, renewed whenever it is used.
  // The whole site needs an account, so signing in again often would be a chore.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
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
        // Counted per address *and* per network location. Keyed on the
        // email alone, anyone could lock a person out of their own account
        // indefinitely just by sending ten wrong passwords for it every
        // fifteen minutes, since the check runs before the password is even
        // looked at. A second, much higher limit on the email alone still
        // stops a spread-out attack on one account.
        const ip = getClientIp(request);
        const rateLimitKey = `login:${ip}:${email}`;
        const accountKey = `login:${email}`;
        const [limitedHere, limitedEverywhere] = await Promise.all([
          isRateLimited(rateLimitKey, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS),
          isRateLimited(accountKey, LOGIN_ACCOUNT_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS),
        ]);
        if (limitedHere || limitedEverywhere) {
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
          await Promise.all([recordHit(rateLimitKey), recordHit(accountKey)]);
          return null;
        }

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) {
          await Promise.all([recordHit(rateLimitKey), recordHit(accountKey)]);
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
        // Signing in. Record when, in a field of our own: the library's
        // built-in `iat` is rewritten every time the token is refreshed, so
        // it can't say when the person actually signed in.
        token.id = user.id;
        token.signedInAt = Date.now();
        return token;
      }

      // Every later request: check the token against the account as it is
      // now. A sign-in token is valid for weeks and is otherwise never
      // looked at again, so this is the only place a revoked session, a
      // deleted account or a renamed user can take effect.
      if (typeof token.id === "string") {
        let account: Awaited<ReturnType<typeof getSessionAccount>>;
        try {
          account = await getSessionAccount(token.id);
        } catch {
          // A database hiccup must not sign everyone out. Keep the session
          // as it is and check again on the next request.
          return token;
        }
        // The account no longer exists.
        if (!account) return null;
        const signedInAt = typeof token.signedInAt === "number" ? token.signedInAt : 0;
        // Signed in before the last "sign out everywhere" or password change.
        if (account.sessionsValidFrom && signedInAt < account.sessionsValidFrom.getTime()) {
          return null;
        }
        // Keeps the name in the session current, so changing a username no
        // longer needs signing out and back in to show up.
        token.name = account.username;
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
