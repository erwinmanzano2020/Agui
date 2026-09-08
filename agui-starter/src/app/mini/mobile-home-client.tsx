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

function statusLabel(action: AguiMobileAction, entry: AguiMobileEntry) {
  if (isMobileActionAvailable(action, entry.launchMode)) return "OPEN";
  if (action.status === "next") return "NEXT";
  if (action.status === "available" && entry.launchMode === "direct") return "TELEGRAM ONLY TODAY";
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
      footer="Shared-foundation POC only. Existing business rules remain in the current Apps Script / Sheets engine."
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
          <p>Telegram signed session data is available. Live workflows still perform their existing server-side verification before returning operational context.</p>
        ) : directSession ? (
          <p>Shared-device Staff PIN identity has been verified. Operational workflows remain separately phase-gated and must re-check authorization at their own server boundary.</p>
        ) : (
          <p>Direct entry can establish a shared-device staff session through the gated Device ID + Employee ID + Staff PIN contract. Until verified, no operational workflow is unlocked.</p>
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
            {isTelegram ? "1 LIVE" : directSession ? "SIGNED IN · NO LIVE ACTIONS" : "SIGN-IN POC"}
          </span>
        </div>

        <div className={styles.actionGrid}>
          {CASHIER_MOBILE_ACTIONS.map((action) => {
            const available = isMobileActionAvailable(action, entry.launchMode);
            const content = (
              <>
                <div className={styles.actionTop}>
                  <span className={styles.actionEmoji} aria-hidden="true">{action.emoji}</span>
                  <span className={`${styles.actionStatus} ${available ? styles.actionStatusLive : ""}`}>{statusLabel(action, entry)}</span>
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
          <p>Direct staff identity can now be represented by a fail-closed POC contract. Start / Resume Shift remains the next operational migration target and is not unlocked by this commit.</p>
        </section>
      ) : null}
    </AguiMobileShell>
  );
}
