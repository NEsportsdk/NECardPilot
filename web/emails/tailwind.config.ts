import { pixelBasedPreset, type TailwindConfig } from "react-email";

export default {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: "#9f93ff",
          background: "#080a10",
          border: "#272b38",
          button: "#7c5cff",
          muted: "#a9afbd",
          surface: "#11141d",
          text: "#f8fafc",
        },
      },
    },
  },
} satisfies TailwindConfig;
