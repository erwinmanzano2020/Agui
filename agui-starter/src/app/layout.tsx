// agui-starter/src/app/layout.tsx
import "./globals.css";
import type { CSSProperties, ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import ThemeProvider from "@/app/providers/theme-provider";
import TenantThemeMount from "@/app/providers/tenant-theme-mount";
import { ToasterMount } from "@/components/ui/toaster";
import { loadUiConfig } from "@/lib/ui-config";
import { themeToCssVars } from "@/lib/theme-css";
import { loadUiTerms } from "@/lib/ui-terms";
import { UiTermsProvider } from "@/lib/ui-terms-context";

// ✅ Client-only palette mount (prevents server from serializing functions)
import CommandPaletteMount from "@/components/ui/command-palette-mount";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Agui",
  description: "Agui — Open-World RPG ERP",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [config, uiTerms] = await Promise.all([loadUiConfig(), loadUiTerms()]);
  const { theme, flags } = config;
  const styleVars = themeToCssVars(theme) as CSSProperties;

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={styleVars}
      >
        <UiTermsProvider terms={uiTerms}>
          <ThemeProvider theme={theme}>
            <TenantThemeMount />
            <AppShell posEnabled={Boolean(flags?.pos_enabled)}>{children}</AppShell>
            <ToasterMount />

            {/* ⌨️ Global Command Palette mounted client-side */}
            <CommandPaletteMount />
          </ThemeProvider>
        </UiTermsProvider>
      </body>
    </html>
  );
}
