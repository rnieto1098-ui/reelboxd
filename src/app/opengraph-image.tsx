import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Flixtally";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The site icon (app/icon.png), embedded as a data URL so the share card
// matches the favicon and navbar logo.
const icon = await readFile(join(process.cwd(), "src/app/icon.png"));
const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

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
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={iconSrc} alt="" width={160} height={160} />
          <div
            style={{
              display: "flex",
              fontSize: 120,
              fontWeight: 700,
              color: "#00e054",
              marginLeft: 36,
            }}
          >
            Flixtally
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#e7e9eb", marginTop: 28 }}>
          Track films you&apos;ve watched. Discover what to watch next.
        </div>
      </div>
    ),
    { ...size }
  );
}
