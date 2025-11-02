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

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return null;
}
