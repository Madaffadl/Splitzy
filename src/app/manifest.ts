import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Splitzy — Split Bills With Friends",
    short_name: "Splitzy",
    description:
      "Split dining or trip expenses fairly with friends. Calculate who owes what with minimal transactions.",
    start_url: "/",
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
