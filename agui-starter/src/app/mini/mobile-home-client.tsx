"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AguiMobileShell from "@/components/mobile/agui-mobile-shell";
import { resolveAguiMobileEntry, type AguiMobileEntry } from "@/lib/mobile/entry";
import {
  CASHIER_MOBILE_ACTIONS,
  isMobileActionAvailable,
  nextMobileAction,
  type AguiMobileAction,
} from "@/lib/mobile/workspace";
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
      footer="Foundation only: existing business rules remain in the current Apps Script / Sheets engine."
    >
      <section className={`${styles.card} ${isTelegram ? styles.readyCard : styles.warningCard}`}>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kicker}>ENTRY MODE</span>
            <strong>{isTelegram ? "Connected through Telegram" : "Direct Agui browser entry"}</strong>
          </div>
          <span className={styles.statusDot} aria-hidden="true" />
        </div>
        {isTelegram ? (
          <p>Telegram signed session data is available. Live workflows still perform their existing server-side verification before returning operational context.</p>
        ) : (
          <p>Direct entry is reachable, but employee + PIN authentication is intentionally not enabled yet. No operational workflow is unlocked from this browser session.</p>
        )}
      </section>

      {!isTelegram ? (
        <section className={`${styles.card} ${styles.authCard}`}>
          <span className={styles.kicker}>DIRECT SIGN-IN</span>
          <strong>Known device → employee → PIN</strong>
          <p>This will be the next shared-auth foundation. We are not faking a login before the server-side identity contract exists.</p>
          <button type="button" disabled className={styles.disabledButton}>DIRECT SIGN-IN · COMING NEXT</button>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>CASHIER WORKSPACE</span>
            <h2>Quick actions</h2>
          </div>
          <span className={styles.sectionHint}>{isTelegram ? "1 LIVE" : "FOUNDATION"}</span>
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
          <p>Once shared direct authentication is established, Start / Resume Shift becomes the first dual-entry operational route.</p>
        </section>
      ) : null}
    </AguiMobileShell>
  );
}
