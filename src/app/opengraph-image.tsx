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

// A dark cinema with an empty left side for the logo (Higgsfield, 1200x630).
const art = await readFile(join(process.cwd(), "src/app/og-art.jpg"));
const artSrc = `data:image/jpeg;base64,${art.toString("base64")}`;

// Rendered once per crawl and cached, so it costs next to nothing.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0a0c10",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
        <img src={artSrc} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(10,12,16,0.92) 0%, rgba(10,12,16,0.6) 45%, rgba(10,12,16,0) 75%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 72px",
            width: "64%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
            <img src={iconSrc} alt="" width={112} height={112} />
            <div
              style={{
                display: "flex",
                fontSize: 96,
                fontWeight: 700,
                color: "#00e054",
                marginLeft: 28,
              }}
            >
              Flixtally
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 38, color: "#e7e9eb", marginTop: 28, lineHeight: 1.25 }}>
            Every film you watch, tallied. Find what to watch next.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
