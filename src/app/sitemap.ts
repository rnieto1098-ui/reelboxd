import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// The site needs an account, so only the pages a signed-out visitor can open.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/signup", "/login", "/terms", "/privacy"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
