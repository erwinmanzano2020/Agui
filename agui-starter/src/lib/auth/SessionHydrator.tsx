"use client";

import { useEffect, useRef } from "react";

import { supabase, syncSession } from "@/lib/auth/client";

export default function SessionHydrator() {
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const performSync = async () => {
      try {
        await syncSession();
      } catch (error) {
        console.warn("Failed to sync Supabase session", error);
      }
    };

    void performSync();

    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      await performSync();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void performSync();
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
