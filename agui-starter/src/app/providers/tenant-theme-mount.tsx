"use client";

import { useEffect, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";
import {
  TENANT_THEME_DEFAULTS,
  applyTenantTheme,
  bootstrapTenantTheme,
  getTenantTheme,
  resolveTenantId,
  type TenantThemeBackground,
  type TenantThemeShape,
} from "@/lib/tenantTheme";

function applyDefaultTheme() {
  applyTenantTheme({
    accent: TENANT_THEME_DEFAULTS.accent,
    background: TENANT_THEME_DEFAULTS.background,
    shape: TENANT_THEME_DEFAULTS.shape,
  });
}

async function hydrateTenantTheme(tenantId: string) {
  bootstrapTenantTheme(tenantId);
  try {
    await getTenantTheme(tenantId, { apply: true });
  } catch (error) {
    console.warn("Failed to hydrate tenant theme", error);
  }
}

export default function TenantThemeMount() {
  const tenantRef = useRef<string | null>(null);
  const [storageTenant, setStorageTenant] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      applyDefaultTheme();
      return;
    }

    let isActive = true;

    const syncFromSession = async (session: Session | null) => {
      if (!isActive) return;

      const tenantId = resolveTenantId(session?.user ?? null);

      if (!tenantId) {
        tenantRef.current = null;
        setStorageTenant(null);
        applyDefaultTheme();
        return;
      }

      if (tenantRef.current === tenantId) {
        return;
      }

      tenantRef.current = tenantId;
      setStorageTenant(tenantId);
      await hydrateTenantTheme(tenantId);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => syncFromSession(data.session ?? null))
      .catch((error) => {
        console.warn("Failed to bootstrap tenant theme session", error);
        applyDefaultTheme();
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      void syncFromSession(session);
    });

    return () => {
      isActive = false;
      tenantRef.current = null;
      setStorageTenant(null);
      listener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!storageTenant) return;

    const storageKey = `agui:tenant-theme:${storageTenant}`;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<{
          accent: string;
          background: TenantThemeBackground;
          shape: TenantThemeShape;
        }>;
        applyTenantTheme({
          accent: parsed.accent ?? TENANT_THEME_DEFAULTS.accent,
          background: parsed.background ?? TENANT_THEME_DEFAULTS.background,
          shape: parsed.shape ?? TENANT_THEME_DEFAULTS.shape,
        });
      } catch (error) {
        console.warn("Failed to read tenant theme from storage event", error);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageTenant]);

  return null;
}
