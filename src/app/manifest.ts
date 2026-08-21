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
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["finance", "productivity", "utilities"],
  };
}
