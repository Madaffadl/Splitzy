import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Content Security Policy ────────────────────────────────────────────────
// Shipped in REPORT-ONLY mode first (audit T-02): the browser reports what an
// enforcing policy *would* block but does not break anything on the live site.
// Once the console/report stream is clean we flip the header name to
// `Content-Security-Policy` (enforcing). Keep the two in sync via CSP_DIRECTIVES.
//
// Origins allowed:
//   - Google Fonts (styles + font files)         fonts.googleapis.com / fonts.gstatic.com
//   - Google profile avatars                      lh3.googleusercontent.com
//   - Supabase (REST + Realtime websocket)        *.supabase.co / wss://*.supabase.co
//   - Google Sign-In                              accounts.google.com
// 'unsafe-inline'/'unsafe-eval' remain for now because Next.js emits inline
// bootstrap scripts/styles; tightening to nonces is a later hardening step.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Report-only: observe violations before enforcing (see note above).
  { key: "Content-Security-Policy-Report-Only", value: CSP_DIRECTIVES },
  // Force HTTPS. Conservative to stay reversible: no includeSubDomains/preload yet.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Block MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking guard (mirrored by CSP frame-ancestors).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Leak the origin but not the path on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app never uses. Receipt capture uses a file
  // input (capture="environment"), which does NOT need the camera permission.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Advertise the API contract version on every API response (audit
        // Sprint 3). See docs/API_VERSIONING.md for the go-forward strategy.
        //
        // ⚠️ This literal duplicates API_VERSION in src/lib/api-version.ts and
        // the two must be bumped together. It cannot be imported: this file is
        // .mjs and loads before any TypeScript transform runs.
        source: "/api/:path*",
        headers: [{ key: "X-API-Version", value: "1" }],
      },
    ];
  },
};

export default nextConfig;
