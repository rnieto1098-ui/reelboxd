// Automated smoke test: signs up a throwaway account, gives it a little real
// data (a rating + a watchlist item), then loads every major page in the app
// signed in and flags any that error out or 404 unexpectedly.
//
// This exists because a stale-variable bug shipped straight to the live
// homepage once (removed a row but left a reference to it behind) and only
// surfaced by actually loading the page — `tsc --noEmit` and the build both
// stayed clean. This script is the cheap, repeatable check for that class of
// bug: run it after any change, before assuming a page still works.
//
// Requires the dev server running (npm run dev) at BASE_URL (defaults to
// http://localhost:3000). Usage: npm run smoke-test

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// A bare `new PrismaClient()` can't find the DB — this app connects via the
// libsql driver adapter (see src/lib/prisma.ts), with DATABASE_URL read
// directly from the environment rather than from schema.prisma's (unused,
// placeholder) datasource url. Without both of those, every query here
// fails with "Unable to open the database file", even against a perfectly
// fine local dev.db.
const adapter = new PrismaLibSQL({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

// Note: Next.js's default not-found page text ("This page could not be
// found") is bundled into a shared client chunk present on every page in
// dev mode, even when nothing actually 404'd — a real 404 is already caught
// by the status code below, so that string isn't a usable red flag here.
const RED_FLAGS = [
  "internal server error",
  "application error: a client-side exception",
  "unhandled runtime error",
  "referenceerror",
  "typeerror:",
];

// --- tiny cookie jar -------------------------------------------------------
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  for (const setCookie of res.headers.getSetCookie?.() ?? []) {
    const [pair] = setCookie.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function req(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Cookie: cookieHeader() },
    redirect: "follow",
  });
  storeCookies(res);
  return res;
}

// --- setup: throwaway account + a little real data --------------------------
// Username schema caps at 20 chars, so keep the timestamp suffix short.
const username = `smoke_${Date.now().toString(36)}`;
const email = `${username}@example.com`;
const password = "SmokeTest123!";

async function signupAndLogin() {
  const signupRes = await req("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (signupRes.status !== 201) {
    throw new Error(`Signup failed: ${signupRes.status}`);
  }

  const csrfRes = await req("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  const loginRes = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
}

async function seedData() {
  // Fight Club (550) and The Godfather (238) — stable, well-known TMDB ids
  // already used elsewhere in this app's own manual testing.
  await req("/api/movies/550/rating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: 4.5 }),
  });
  await req("/api/movies/238/watchlist", { method: "POST" });
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { username } });
  await prisma.$disconnect();
}

// --- the actual page checks --------------------------------------------------
async function checkRoutes() {
  const firstList = await prisma.list.findFirst({ select: { id: true } });

  const routes = [
    "/",
    "/lists",
    ...(firstList ? [`/lists/${firstList.id}`] : []),
    "/search?q=Inception",
    "/search?q=Inception&page=2",
    "/crew",
    "/movie/550",
    "/streaming",
    "/watchlist",
    "/recommend",
    "/import",
    "/settings",
    "/login",
    "/signup",
    "/forgot-password",
    "/robots.txt",
    "/sitemap.xml",
    `/profile/${username}`,
    `/profile/${username}/diary`,
    `/profile/${username}/stats`,
    `/profile/${username}/year`,
  ];

  const results = [];
  for (const route of routes) {
    let res;
    let body = "";
    let error = null;
    try {
      res = await req(route);
      body = await res.text();
    } catch (e) {
      error = e.message;
    }

    const lowerBody = body.toLowerCase();
    const flagged = RED_FLAGS.find((flag) => lowerBody.includes(flag));
    const ok = !error && res.ok && !flagged;

    results.push({ route, ok, status: res?.status, error, flagged });
  }

  return results;
}

async function main() {
  console.log(`Smoke testing ${BASE_URL} as throwaway account "${username}"...\n`);

  try {
    await signupAndLogin();
    await seedData();
    const results = await checkRoutes();

    for (const r of results) {
      if (r.ok) {
        console.log(`  PASS  ${r.route}`);
      } else {
        console.log(`  FAIL  ${r.route}  ${r.error ?? `status ${r.status}` }${r.flagged ? ` — found "${r.flagged}"` : ""}`);
      }
    }

    const failures = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failures.length}/${results.length} passed.`);

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await cleanup();
  }
}

main();
