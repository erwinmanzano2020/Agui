"use client";

import { useEffect } from "react";

import { supabase, syncSession } from "@/lib/auth/client";

export default function SessionSync() {
  useEffect(() => {
    const runInitialSync = async () => {
      try {
        await syncSession();
      } catch (error) {
        console.warn("Failed to sync Supabase session", error);
      }
    };

    void runInitialSync();

    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      try {
        await syncSession();
      } catch (error) {
        console.warn("Failed to sync Supabase session", error);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runInitialSync();
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
