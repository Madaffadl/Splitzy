import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, HTML_LANG } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// PWA manifest. Name and description mirror the Indonesian metadata so the
// installed app, the browser install prompt, and the search result all describe
// Splitzy the same way — inconsistent naming across surfaces is one of the
// things that muddies entity recognition for a contested brand name.
const dict = getDictionary(DEFAULT_LOCALE);

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: dict.meta.home.title,
    short_name: "Splitzy",
    description: dict.meta.home.description,
    lang: HTML_LANG[DEFAULT_LOCALE],
    dir: "ltr",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#fbfaf5",
    theme_color: "#3a4a1f",
    orientation: "portrait",
    // Icons are derived from Splitzy-Color-Bgwhite.jpeg (2048×2048 square) by
    // the recipe in docs/PWA_ICONS.md. Two rules the previous set broke, both of
    // which silently killed Android installs:
    //
    //   1. The declared `sizes` must match the file's real pixel dimensions.
    //      /logo.png was declared 512×512 while actually being 1920×2194.
    //   2. A `maskable` icon needs its own asset with padding. Android crops to
    //      a circle of 80% diameter, so a logo that fills the canvas loses its
    //      top and bottom. The maskable variant scales the mark to 410/512 and
    //      pads with the source background.
    //
    // manifest-icons.test.ts enforces (1) against the actual files on disk.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["finance", "productivity", "utilities"],
  };
}
