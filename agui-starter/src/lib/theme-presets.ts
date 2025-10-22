export type PresetKey = "Black" | "Charcoal" | "Pearl" | "White" | "Emerald" | "Royal";

export type Preset = {
  name: PresetKey;
  wallpaper?: "black" | "charcoal" | "pearl" | "white";
  iconContainerHex?: string;
  labelHex?: string;
  accentHex?: string;
  background?: "system" | "light" | "dark";
};

export const THEME_PRESETS: Preset[] = [
  {
    name: "Black",
    wallpaper: "black",
    iconContainerHex: "#0c0c0d",
    labelHex: "#e8e8ea",
    background: "dark",
  },
  {
    name: "Charcoal",
    wallpaper: "charcoal",
    iconContainerHex: "#1b1c1f",
    labelHex: "#dfe2e6",
    background: "dark",
  },
  {
    name: "Pearl",
    wallpaper: "pearl",
    iconContainerHex: "#eef1f6",
    labelHex: "#1b1c1f",
    background: "light",
  },
  {
    name: "White",
    wallpaper: "white",
    iconContainerHex: "#ffffff",
    labelHex: "#0f1115",
    background: "light",
  },
  {
    name: "Emerald",
    accentHex: "#10b981",
    background: "system",
  },
  {
    name: "Royal",
    accentHex: "#4f46e5",
    background: "dark",
  },
];

export const DEFAULT_PRESET: PresetKey = "Pearl";

export const hexToHslTriplet = (hex: string): string => {
  const v = hex.replace("#", "");
  const normalized = v.length === 3 ? v.split("").map((c) => `${c}${c}`).join("") : v;
  const n = parseInt(normalized, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h =
      max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};
