export type ThemeConfig = {
  primary_hsl: string; // e.g. "221 83% 53%"
  accent_hsl: string;  // e.g. "160 84% 39%"
  radius_px: number;   // e.g. 14
};

// Defaults must mirror globals.css
export const DEFAULT_THEME: ThemeConfig = {
  primary_hsl: "221 83% 53%",
  accent_hsl: "160 84% 39%",
  radius_px: 14,
};
