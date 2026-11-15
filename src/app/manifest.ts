import type { MetadataRoute } from "next";

// What a phone or desktop needs to install the site as an app: its name, the
// icon for the home screen, and the colours to show while it starts up.
// `display: "standalone"` opens it in its own window with no browser bars.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Flixtally",
    short_name: "Flixtally",
    description: "Track films you've watched. Discover what to watch next.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed copies a launcher can crop into a circle or squircle.
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon to jump straight to one of these.
    shortcuts: [
      {
        name: "Today's Daily Reel",
        short_name: "Daily Reel",
        url: "/play",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Watchlist",
        url: "/watchlist",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Search films",
        short_name: "Search",
        url: "/search",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
