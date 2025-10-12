// agui-starter/src/app/layout.tsx
import "./globals.css";
import type { CSSProperties, ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { loadUiConfig } from "@/lib/ui-config";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Agui",
  description: "Agui — Open-World RPG ERP",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme } = await loadUiConfig();

  const styleVars: CSSProperties = {
    ["--agui-primary" as any]: theme.primary_hex,
    ["--agui-surface" as any]: theme.surface,
    ["--agui-accent" as any]: theme.accent,
    ["--agui-radius" as any]: `${theme.radius}px`,
  };

  return (
    <html lang="en" style={styleVars}>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
