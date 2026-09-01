import { pixelBasedPreset, type TailwindConfig } from "react-email";

export default {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: "#a99bff",
          background: "#07090d",
          border: "#292d3b",
          button: "#7867ff",
          champagne: "#cbae72",
          muted: "#aab1c0",
          surface: "#10141c",
          text: "#f5f7fb",
        },
      },
    },
  },
} satisfies TailwindConfig;

export const brandAssets = {
  logo: {
    alt: "Vallective",
    height: 52,
    src: "https://vallective.com/icons/vallective-email-mark.png",
    width: 52,
  },
} as const;
