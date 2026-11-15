// Where a signed-out visitor is sent when they try something that needs an
// account, and how they get back afterwards.
//
// Every such redirect used to go to a bare /login, and signing in always
// landed on the home page: click "Watchlist" on a film, sign in, and the
// film you were looking at was gone. The page they were on now rides along
// as ?next= and the login page returns them to it.

/** The login URL that returns to the current page. Call from the browser. */
export function loginHref(): string {
  if (typeof window === "undefined") return "/login";
  const { pathname, search } = window.location;
  if (pathname === "/login" || pathname === "/signup") return "/login";
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}

/**
 * The page to go to after signing in: the requested `next` if it is a plain
 * path on this site, otherwise the home page.
 *
 * The check matters. `next` comes from the URL, which anyone can craft, and
 * an unchecked redirect would let a link to this site's own login page
 * bounce a freshly signed-in user to another site. "//host" and "/\host"
 * are both read by browsers as other sites, so only a single leading slash
 * followed by a normal path character is accepted.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!/^\/(?![/\\])/.test(next)) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  if (next.startsWith("/login") || next.startsWith("/signup")) return "/";
  return next;
}
