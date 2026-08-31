import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Kept to the small set of genuinely public, non-personalized entry points —
// movie/[tmdbId], profile/[username], and lists/[listId] are dynamic and
// numerous enough that a real sitemap for them would need to page through
// the DB; not worth it yet for a project this size.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/crew", "/login", "/signup"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
