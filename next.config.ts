import type { NextConfig } from "next";

// Sent with every response. None of these change how the site looks; they
// stop other sites from framing it, stop browsers guessing content types,
// and keep full URLs out of the Referer header sent to other sites.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    // Next 16 only serves the qualities listed here; anything else is
    // silently coerced to the nearest one. Posters use 80, the large movie
    // page poster and hero stills use 90.
    qualities: [75, 80, 90],
    // TMDB poster and still URLs never change once issued, so optimised
    // copies can be kept for a month rather than the short default.
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
