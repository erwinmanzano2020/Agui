"use client";

import { useEffect, useRef } from "react";

import { supabase, syncSession } from "@/lib/auth/client";

export default function SessionHydrator() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const runSync = async () => {
      try {
        await syncSession();
      } catch (error) {
        console.warn("Failed to sync Supabase session", error);
      }
    };

    void runSync();

    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      await runSync();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
