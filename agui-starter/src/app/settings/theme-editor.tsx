"use client";

import * as React from "react";
import { ThemeConfig } from "@/lib/theme";
import { setTheme } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

// Helpers: HEX <-> HSL (for friendlier inputs)
function hexToHslTriplet(hex: string): string {
  const v = hex.replace("#", "");
  const bigint = parseInt(v.length === 3 ? v.split("").map((c) => c + c).join("") : v, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;
  const l = (max + min) / 2; // <-- const (fixes prefer-const)

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslTripletToHex(hsl: string): string {
  // "H S% L%"
  const [H, S, L] = hsl.split(" ").map((t, i) => (i === 0 ? parseFloat(t) : parseFloat(t)));
  const h = (H % 360) / 360;
  const s = Math.max(0, Math.min(1, (S || 0) / 100));
  const l = Math.max(0, Math.min(1, (L || 0) / 100));

  if (s === 0) {
    const v = Math.round(l * 255);
    const hexGray = (v << 16) | (v << 8) | v;
    return `#${hexGray.toString(16).padStart(6, "0")}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    // normalize t
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  const hex =
    ((Math.round(r * 255) << 16) |
      (Math.round(g * 255) << 8) |
      Math.round(b * 255))
      .toString(16)
      .padStart(6, "0");

  return `#${hex}`;
}

type Props = { initial: ThemeConfig };

export default function ThemeEditor({ initial }: Props) {
  const toast = useToast();

  // Visible form values (hex + px). Convert between HEX<->HSL under the hood.
  const [primaryHex, setPrimaryHex] = React.useState(hslTripletToHex(initial.primary_hsl));
  const [accentHex, setAccentHex] = React.useState(hslTripletToHex(initial.accent_hsl));
  const [radius, setRadius] = React.useState<number>(initial.radius_px);

  // Optimistic apply to CSS vars on change
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--agui-primary", hexToHslTriplet(primaryHex));
    root.style.setProperty("--agui-accent", hexToHslTriplet(accentHex));
    root.style.setProperty("--agui-radius", `${radius}px`);
  }, [primaryHex, accentHex, radius]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: ThemeConfig = {
        primary_hsl: hexToHslTriplet(primaryHex),
        accent_hsl: hexToHslTriplet(accentHex),
        radius_px: Number(radius) || 14,
      };
      await setTheme(payload);
      toast.success("Theme saved ✔");
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(err);
      toast.error("Failed to save theme");
    }
  }

  return (
    <form onSubmit={onSave} className="agui-card p-5 space-y-5 max-w-xl">
      <div className="text-lg font-semibold">Theme Editor</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold mb-1">Primary color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
              className="h-10 w-12 rounded-xl border"
              aria-label="Primary color"
            />
            <Input value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} />
          </div>
          <div className="text-[11px] opacity-70 mt-1">Affects buttons/links. Saved as HSL.</div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Accent color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              className="h-10 w-12 rounded-xl border"
              aria-label="Accent color"
            />
            <Input value={accentHex} onChange={(e) => setAccentHex(e.target.value)} />
          </div>
          <div className="text-[11px] opacity-70 mt-1">Used for hover/active highlights.</div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Radius (px)</label>
          <Input
            type="number"
            min={0}
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value || "0", 10))}
          />
          <div className="text-[11px] opacity-70 mt-1">Controls rounded corners app-wide.</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Save</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPrimaryHex(hslTripletToHex(initial.primary_hsl));
            setAccentHex(hslTripletToHex(initial.accent_hsl));
            setRadius(initial.radius_px);
          }}
        >
          Reset to loaded
        </Button>
      </div>
    </form>
  );
}
