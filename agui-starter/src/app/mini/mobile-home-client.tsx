"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AguiMobileShell from "@/components/mobile/agui-mobile-shell";
import type { DirectStaffSession } from "@/lib/mobile/direct-auth";
import { resolveAguiMobileEntry, type AguiMobileEntry } from "@/lib/mobile/entry";
import {
  CASHIER_MOBILE_ACTIONS,
  isMobileActionAvailable,
  nextMobileAction,
  type AguiMobileAction,
} from "@/lib/mobile/workspace";
import DirectSignIn from "./direct-sign-in";
import styles from "./mobile-home.module.css";

type EntryState =
  | { status: "loading" }
  | { status: "ready"; entry: AguiMobileEntry };

function actionAvailable(action: AguiMobileAction, entry: AguiMobileEntry, directSession: DirectStaffSession | null) {
  if (!isMobileActionAvailable(action, entry.launchMode)) return false;
  if (entry.launchMode === "direct" && !directSession) return false;
  return true;
}

function statusLabel(action: AguiMobileAction, entry: AguiMobileEntry, directSession: DirectStaffSession | null) {
  if (actionAvailable(action, entry, directSession)) return "OPEN";
  if (action.status === "next") return "NEXT";
  if (action.status === "available" && entry.launchMode === "direct" && !action.launchModes.includes("direct")) return "TELEGRAM ONLY TODAY";
  if (action.status === "available" && entry.launchMode === "direct" && !directSession) return "SIGN IN FIRST";
  return "PLANNED";
}

export default function MobileHomeClient() {
  const [entryState, setEntryState] = useState<EntryState>({ status: "loading" });
  const [directSession, setDirectSession] = useState<DirectStaffSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveAguiMobileEntry(window).then((entry) => {
      if (!cancelled) setEntryState({ status: "ready", entry });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entryState.status === "loading") {
    return (
      <AguiMobileShell title="My Workspace" subtitle="Preparing Agui Mobile…">
        <section className={styles.card}>
          <strong>Loading entry context…</strong>
          <p>Checking whether Agui was opened from Telegram or directly in the browser.</p>
        </section>
      </AguiMobileShell>
    );
  }

  const { entry } = entryState;
  const isTelegram = entry.launchMode === "telegram";
  const nextAction = nextMobileAction();

  return (
    <AguiMobileShell
      title="My Workspace"
      subtitle="One frontline app · Telegram shortcut or direct Agui entry"
      badge={<span className={`${styles.modeBadge} ${isTelegram ? styles.telegramBadge : styles.directBadge}`}>{isTelegram ? "TELEGRAM" : "DIRECT"}</span>}
      footer="Existing business rules remain in the current Apps Script / Sheets engine. Each operational route re-checks authorization server-side."
    >
      <section className={`${styles.card} ${isTelegram || directSession ? styles.readyCard : styles.warningCard}`}>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kicker}>ENTRY MODE</span>
            <strong>
              {isTelegram
                ? "Connected through Telegram"
                : directSession
                  ? `Direct staff session · ${directSession.employeeName}`
                  : "Direct Agui browser entry"}
            </strong>
          </div>
          <span className={styles.statusDot} aria-hidden="true" />
        </div>
        {isTelegram ? (
          <p>Telegram signed session data is available. Live workflows still perform server-side verification before returning or changing operational context.</p>
        ) : directSession ? (
          <p>Shared-device Staff PIN identity is verified. Start / Resume Shift is now the first direct operational route, with Apps Script revalidating the canonical staff session before any write.</p>
        ) : (
          <p>Sign in through the shared-device Device ID + Employee ID + Staff PIN contract before opening any direct operational workflow.</p>
        )}
      </section>

      {!isTelegram ? <DirectSignIn onSessionChange={setDirectSession} /> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>CASHIER WORKSPACE</span>
            <h2>Quick actions</h2>
          </div>
          <span className={styles.sectionHint}>
            {isTelegram ? "3 LIVE" : directSession ? "2 LIVE" : "SIGN IN FIRST"}
          </span>
        </div>

        <div className={styles.actionGrid}>
          {CASHIER_MOBILE_ACTIONS.map((action) => {
            const available = actionAvailable(action, entry, directSession);
            const content = (
              <>
                <div className={styles.actionTop}>
                  <span className={styles.actionEmoji} aria-hidden="true">{action.emoji}</span>
                  <span className={`${styles.actionStatus} ${available ? styles.actionStatusLive : ""}`}>{statusLabel(action, entry, directSession)}</span>
                </div>
                <strong>{action.label}</strong>
                <span className={styles.actionDescription}>{action.description}</span>
              </>
            );

            if (available && action.href) {
              return <Link key={action.key} href={action.href} className={`${styles.actionCard} ${styles.liveAction}`}>{content}</Link>;
            }

            return <div key={action.key} className={`${styles.actionCard} ${styles.disabledAction}`} aria-disabled="true">{content}</div>;
          })}
        </div>
      </section>

      {nextAction ? (
        <section className={`${styles.card} ${styles.nextCard}`}>
          <span className={styles.kicker}>NEXT BUILD TARGET</span>
          <strong>{nextAction.emoji} {nextAction.label}</strong>
          <p>Customer Utang Gate 1 is now available as a read-only context and preview screen. No Customer Utang posting is enabled.</p>
        </section>
      ) : null}
    </AguiMobileShell>
  );
}
