// agui-starter/src/app/layout.tsx
import "./globals.css";
import type { CSSProperties, ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import ThemeProvider from "@/app/providers/theme-provider";
import { ToasterMount } from "@/components/ui/toaster";
import { loadUiConfig } from "@/lib/ui-config";
import { themeToCssVars } from "@/lib/theme-css";

// ⬇️ Command Palette
import { CommandPalette } from "../components/ui/command-palette";
import { commands } from "../config/commands";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Agui",
  description: "Agui — Open-World RPG ERP",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme } = await loadUiConfig();
  const styleVars = themeToCssVars(theme) as CSSProperties;

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        // We still inline brand tokens at body-level as CSS variables if you want:
        style={styleVars}
      >
        <ThemeProvider theme={theme}>
          <AppShell>{children}</AppShell>
          <ToasterMount />

          {/* ⌨️ Global Command Palette (mounted last inside body) */}
          <CommandPalette commands={commands} />
          {/* Theme toggle now lives in the AppShell header. */}
        </ThemeProvider>
      </body>
    </html>
  );
}
