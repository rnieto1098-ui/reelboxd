import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated rather than a static asset — no design file to keep in sync,
// and it's cheap since Next only renders this once per crawl (cached).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#14181c",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, fontWeight: 700, color: "#00e054" }}>
          reelboxd
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#e7e9eb", marginTop: 16 }}>
          Track films you&apos;ve watched. Discover what to watch next.
        </div>
      </div>
    ),
    { ...size }
  );
}
