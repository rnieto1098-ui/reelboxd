import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// The whole site sits behind an account. A visitor without a valid session
// is sent to sign up, or to sign in if this device has been signed in before.
//
// The check reads the signed session cookie only. It never touches the
// database, so it stays fast and cheap even when crawlers hammer the site,
// and they get a redirect instead of a full page render.

/** Set on a device once it has had a signed-in session. Sends it to /login instead of /signup. */
const KNOWN_DEVICE_COOKIE = "ft_known";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const PUBLIC_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/privacy", "/terms"];
// Sign-in, sign-up and password reset, plus the scheduled jobs (which check their own secret).
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/cron/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search, searchParams, protocol } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // The sign-in pages show this site's own images (the logo). Remote ones,
  // like TMDB posters, are what crawlers were running up the bill on.
  if (pathname === "/_next/image") {
    const src = searchParams.get("url") ?? "";
    if (src.startsWith("/") && !src.startsWith("//")) return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: protocol === "https:",
  });

  if (token) {
    const res = NextResponse.next();
    if (!req.cookies.has(KNOWN_DEVICE_COOKIE)) {
      res.cookies.set(KNOWN_DEVICE_COOKIE, "1", {
        maxAge: ONE_YEAR_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: protocol === "https:",
        httpOnly: true,
      });
    }
    return res;
  }

  if (pathname.startsWith("/api/") || pathname === "/_next/image") {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const dest = new URL(req.cookies.has(KNOWN_DEVICE_COOKIE) ? "/login" : "/signup", req.url);
  if (pathname !== "/") dest.searchParams.set("next", pathname + search);
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: [
    // Everything except build assets, icons, metadata files and anything with a static file extension.
    "/((?!_next/static|_next/data|favicon\\.ico|icon\\.png|apple-icon\\.png|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|opengraph-image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|webmanifest|js|css|map|woff2?|html)$).*)",
  ],
};
