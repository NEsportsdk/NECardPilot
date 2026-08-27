import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vallective – Collector Intelligence",
    short_name: "Vallective",
    description:
      "Scan, organize, value and understand your sports card collection.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#07090d",
    theme_color: "#07090d",
    categories: ["sports", "finance", "utilities"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Scan a card",
        short_name: "Scanner",
        description: "Open Vallective's card scanner.",
        url: "/scanner",
        icons: [
          {
            src: "/favicon.ico",
            sizes: "256x256",
            type: "image/x-icon",
          },
        ],
      },
      {
        name: "Open card library",
        short_name: "Cards",
        description: "Browse and search your card library.",
        url: "/cards",
        icons: [
          {
            src: "/favicon.ico",
            sizes: "256x256",
            type: "image/x-icon",
          },
        ],
      },
    ],
  };
}
