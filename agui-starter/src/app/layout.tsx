// agui-starter/src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import ThemeProvider from "@/app/providers/theme-provider";
import { ToasterMount } from "@/components/ui/toaster";
import ThemeToggle from "@/components/ui/theme-toggle";
import { loadUiConfig } from "@/lib/ui-config";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Agui",
  description: "Agui — Open-World RPG ERP",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme } = await loadUiConfig();

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider theme={theme}>
          <AppShell>{children}</AppShell>
          <ToasterMount />
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
