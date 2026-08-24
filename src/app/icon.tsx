import { ImageResponse } from "next/og";

// App icon (favicon) — generated at request time by the file convention.
//
// The original logo.png is 1920×2194 (portrait). Google requires favicons to
// be square and ≥48×48; it shows the generic globe icon for non-square images.
// This generates a 512×512 square icon using the same brand palette as the OG
// card, so every surface that fetches a favicon gets a legible, on-brand mark.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const OLIVE = "#3a4a1f";
const ACCENT = "#c8d96f";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OLIVE,
          borderRadius: 112,
        }}
      >
        <span
          style={{
            fontSize: 300,
            fontWeight: 800,
            color: ACCENT,
            fontFamily: "sans-serif",
            lineHeight: 1,
            marginTop: 16,
          }}
        >
          S
        </span>
      </div>
    ),
    { ...size }
  );
}
