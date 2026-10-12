// Single source of truth for the deployed origin — used by metadata
// (Open Graph/Twitter cards, sitemap, robots.txt) and by anything that needs
// to build an absolute URL outside of a request context (e.g. a password
// reset link inside an email). Set NEXT_PUBLIC_SITE_URL in Vercel once a
// custom domain is attached; otherwise it falls back to the project's
// production domain, which Vercel sets on every build and runtime (and which
// follows a custom domain once one is made primary), then to localhost.
// It used to fall back to a hardcoded https://flixtally.com — a domain not
// attached to the project — so share images and reset links pointed nowhere.
// `|| ` (not `??`) deliberately — an env var set to an empty string (a
// common outcome of leaving a dashboard field blank) must fall back too, not
// just an unset one, or `new URL("")` throws.
const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelProductionHost ? `https://${vercelProductionHost}` : "http://localhost:3000");
