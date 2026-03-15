// agui-starter/src/components/ui/command-palette-mount.tsx
"use client";

import dynamic from "next/dynamic";

import { getCommandRegistry } from "@/lib/commands/registry";
import { useUiTerms } from "@/lib/ui-terms-context";

// Load the actual palette only on the client
const Palette = dynamic(
  () => import("./command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);

export default function CommandPaletteMount() {
  const terms = useUiTerms();
  return <Palette commands={getCommandRegistry(terms)} />;
}
