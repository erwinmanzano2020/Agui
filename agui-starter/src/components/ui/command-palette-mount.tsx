// agui-starter/src/components/ui/command-palette-mount.tsx
"use client";

import dynamic from "next/dynamic";
import { commands } from "@/config/commands";

// Load the actual palette only on the client
const Palette = dynamic(
  () => import("./command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);

export default function CommandPaletteMount() {
  return <Palette commands={commands} />;
}
