import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "iShortn - Free URL Shortener with Analytics";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const fontData = readFileSync(
    join(process.cwd(), "src/app/fonts/BerkeleyMono.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f5f5f4",
          padding: "40px",
          fontFamily: "Berkeley Mono",
        }}
      >
        {/* Lighter continuous lines */}
        <div style={{ position: "absolute", top: 50, left: 20, width: 1160, height: 1, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", bottom: 50, left: 20, width: 1160, height: 1, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", top: 20, left: 50, width: 1, height: 590, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", top: 20, right: 50, width: 1, height: 590, backgroundColor: "#ddd" }} />

        {/* Bold L-shaped corner marks */}
        <div style={{ position: "absolute", top: 50, left: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, left: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, right: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, right: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, left: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, left: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, right: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, right: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            padding: "60px 100px 90px 100px",
          }}
        >
          {/* Category label */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 400,
              color: "#2563eb",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 20,
            }}
          >
            URL SHORTENER
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 400,
              color: "#1a1a1a",
              lineHeight: 1.1,
            }}
          >
            iShortn
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 20,
              fontWeight: 400,
              color: "#aaa",
              marginTop: 16,
              gap: 12,
            }}
          >
            <span>Short Links</span>
            <span>·</span>
            <span>Analytics</span>
            <span>·</span>
            <span>QR Codes</span>
            <span>·</span>
            <span>Custom Domains</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Berkeley Mono",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
