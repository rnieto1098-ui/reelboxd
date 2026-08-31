import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personal, auth-gated pages have no value indexed and would just
        // dilute crawl budget away from the pages worth ranking.
        disallow: ["/api/", "/settings", "/watchlist", "/import", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
