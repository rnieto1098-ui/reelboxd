// Single source of truth for the deployed origin — used by metadata
// (Open Graph/Twitter cards, sitemap, robots.txt) and by anything that needs
// to build an absolute URL outside of a request context (e.g. a password
// reset link inside an email). Set NEXT_PUBLIC_SITE_URL in Vercel once a
// custom domain is attached; falls back to the default Vercel URL.
// `|| ` (not `??`) deliberately — an env var set to an empty string (a
// common outcome of leaving a dashboard field blank) must fall back too, not
// just an unset one, or `new URL("")` throws.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://flixtally.com";
