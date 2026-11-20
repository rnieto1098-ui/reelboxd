import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// The site needs an account, so only the sign-up and sign-in pages (and the
// legal pages) are worth crawling. Everything else redirects to sign-up.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // These two ran up the hosting bill crawling film pages and images.
      { userAgent: ["AhrefsBot", "meta-externalagent", "meta-externalfetcher"], disallow: "/" },
      {
        userAgent: "*",
        allow: ["/signup", "/login", "/privacy", "/terms"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
