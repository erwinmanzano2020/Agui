"use client";

import { useEffect } from "react";

import { supabase, syncSession } from "@/lib/auth/client";

function logSyncError(error: unknown) {
  console.warn("Failed to sync Supabase session", error);
}

export function SessionSync() {
  useEffect(() => {
    const runSync = async (session?: Parameters<typeof syncSession>[0]) => {
      try {
        await syncSession(session);
      } catch (error) {
        logSyncError(error);
      }
    };

    void runSync();

    const { data: subscription } = supabase.auth.onAuthStateChange((_, nextSession) => {
      void runSync(nextSession ?? null);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
