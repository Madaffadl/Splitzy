import { ImageResponse } from "next/og";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

// Social share card (SEO Sprint 7).
//
// This replaces the raw logo, which was a 1920×2194 *portrait* PNG. Every social
// platform and Google Discover expects a ~1.91:1 landscape image, so the logo was
// being centre-cropped into an unreadable sliver on WhatsApp, X, Facebook and
// LinkedIn. Since a link shared into a WhatsApp group is how Splitzy actually
// spreads, a broken preview was directly costing click-throughs — and social
// engagement feeds back into brand-query volume, which is what we need to win
// the "splitzy" search.
//
// Generated at build time by the file convention, so it costs nothing at runtime
// and applies to every route beneath app/ that doesn't override it.

const dict = getDictionary(DEFAULT_LOCALE);

export const alt = dict.meta.home.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (mirrors tailwind.config.ts / globals.css).
const CHARCOAL = "#1b1d17";
const OLIVE = "#3a4a1f";
const CREAM = "#fbfaf5";
const ACCENT = "#c8d96f";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          backgroundColor: CHARCOAL,
          backgroundImage: `radial-gradient(circle at 78% 18%, ${OLIVE}dd 0%, transparent 55%), radial-gradient(circle at 8% 92%, ${ACCENT}22 0%, transparent 45%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 76,
              height: 76,
              borderRadius: 22,
              backgroundColor: ACCENT,
              color: CHARCOAL,
              fontSize: 46,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: CREAM, letterSpacing: -1 }}>
              Splitzy
            </span>
            <span style={{ fontSize: 19, color: `${CREAM}99`, marginTop: 2 }}>
              {dict.header.tagline}
            </span>
          </div>
        </div>

        {/* Promise */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              color: CREAM,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {dict.hero.titleAccent}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              color: ACCENT,
              lineHeight: 1.1,
              letterSpacing: -2,
              marginTop: 4,
            }}
          >
            {dict.hero.titleRest}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 27,
              color: `${CREAM}bb`,
              marginTop: 22,
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            {dict.og.subline}
          </div>
        </div>

        {/* Domain */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: ACCENT,
            }}
          />
          <span style={{ fontSize: 25, color: CREAM, fontWeight: 600 }}>
            splitzy.my.id
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
