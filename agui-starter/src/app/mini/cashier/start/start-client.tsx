"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AguiMobileShell from "@/components/mobile/agui-mobile-shell";
import {
  openingFundDiffers,
  type CashierStartContextResponse,
  type CashierStartContextSuccess,
  type CashierStartSubmitPayload,
  type CashierStartSubmitResponse,
} from "@/lib/mobile/cashier-start";
import { resolveAguiMobileEntry, type AguiMobileEntry } from "@/lib/mobile/entry";
import styles from "./start.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string; code?: string; entry?: AguiMobileEntry }
  | { status: "ready"; context: CashierStartContextSuccess; entry: AguiMobileEntry }
  | { status: "success"; result: Extract<CashierStartSubmitResponse, { ok: true }>; entry: AguiMobileEntry };

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
}

export default function CashierStartClient() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [actualFund, setActualFund] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function load() {
    setState({ status: "loading" });
    setSubmitError("");
    try {
      const entry = await resolveAguiMobileEntry(window);
      const result = await postJson<CashierStartContextResponse>("/api/miniapp/cashier/start/context", {
        initData: entry.telegramInitData,
      });
      if (!result.ok) {
        setState({ status: "error", message: result.message, code: result.code, entry });
        return;
      }
      setState({ status: "ready", context: result, entry });
      const initial = result.openingFund.requiresNewFund ? "" : String(result.openingFund.expectedAmount ?? 0);
      setActualFund(initial);
      setReason("");
      setConfirmed(false);
    } catch {
      setState({ status: "error", message: "Could not load Cashier Start / Resume. Check connection and try again." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const parsedActual = useMemo(() => {
    const normalized = actualFund.replace(/,/g, "").trim();
    if (!normalized) return null;
    const value = Number(normalized);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [actualFund]);

  async function submit(payload: CashierStartSubmitPayload, entry: AguiMobileEntry) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await postJson<CashierStartSubmitResponse>("/api/miniapp/cashier/start/submit", {
        initData: entry.telegramInitData,
        payload,
      });
      if (!result.ok) {
        setSubmitError(result.message);
        if (result.refreshRequired || result.code === "STATE_CHANGED") await load();
        return;
      }
      setState({ status: "success", result, entry });
    } catch {
      setSubmitError("Cashier Start / Resume could not finish. Check connection before retrying.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <AguiMobileShell title="Start / Resume Shift" subtitle="Preparing your cashier context…">
        <section className={styles.card}><strong>Loading cashier state…</strong><p>Agui is checking your verified staff identity, branch, cash box, and prior fund state.</p></section>
      </AguiMobileShell>
    );
  }

  if (state.status === "error") {
    return (
      <AguiMobileShell title="Start / Resume Shift" subtitle="Cashier access check">
        <section className={`${styles.card} ${styles.errorCard}`}>
          <span className={styles.kicker}>CANNOT CONTINUE</span>
          <strong>{state.message}</strong>
          {state.code ? <p>Code: {state.code}</p> : null}
          <button type="button" className={styles.secondaryButton} onClick={() => void load()}>TRY AGAIN</button>
          <Link href="/mini" className={styles.linkButton}>BACK TO MY WORKSPACE</Link>
        </section>
      </AguiMobileShell>
    );
  }

  if (state.status === "success") {
    const { result, entry } = state;
    return (
      <AguiMobileShell title="Cashier Shift" subtitle={entry.launchMode === "telegram" ? "Opened through Telegram → Agui" : "Opened through Direct Agui"}>
        <section className={`${styles.card} ${styles.successCard}`}>
          <span className={styles.kicker}>SHIFT {result.operation === "RESUME" ? "RESUMED" : "OPEN"}</span>
          <strong>✓ {result.shift.cashierName} · {result.shift.branchLabel}</strong>
          <dl className={styles.grid}>
            <div><dt>Cash box</dt><dd>{result.shift.cashBoxLabel}</dd></div>
            <div><dt>Status</dt><dd>{result.shift.status}</dd></div>
            <div><dt>Shift ID</dt><dd>{result.shift.shiftId}</dd></div>
            <div><dt>Business date</dt><dd>{result.shift.businessDate}</dd></div>
          </dl>
          {result.openingFund ? <p>Opening fund accepted: <strong>{money(result.openingFund.actualAmount)}</strong></p> : null}
          {Number(result.preShiftCashMoved ?? 0) > 0 ? <p>Recorded company cash moved into the drawer: <strong>{money(result.preShiftCashMoved)}</strong></p> : null}
          <Link href="/mini" className={styles.primaryLink}>GO TO MY WORKSPACE</Link>
        </section>
      </AguiMobileShell>
    );
  }

  const { context, entry } = state;
  const isPaused = context.state === "PAUSED" && context.existingShift;
  const isOpen = context.state === "OPEN" && context.existingShift;
  const differs = parsedActual !== null && openingFundDiffers(context, parsedActual);
  const canStart = parsedActual !== null && confirmed && (!differs || Boolean(reason.trim()));

  return (
    <AguiMobileShell
      title="Start / Resume Shift"
      subtitle={`${context.actor.name} · ${context.branch.label}`}
      badge={<span className={styles.modeBadge}>{entry.launchMode === "telegram" ? "TELEGRAM" : "DIRECT"}</span>}
      footer="The same Apps Script cashier rules remain authoritative for both launch modes."
    >
      <section className={`${styles.card} ${styles.identityCard}`}>
        <span className={styles.kicker}>VERIFIED CASHIER CONTEXT</span>
        <strong>{context.actor.name} · {context.actor.employeeId}</strong>
        <dl className={styles.grid}>
          <div><dt>Branch</dt><dd>{context.branch.label}</dd></div>
          <div><dt>Cash box</dt><dd>{context.cashBoxLabel}</dd></div>
        </dl>
      </section>

      {isOpen ? (
        <section className={`${styles.card} ${styles.successCard}`}>
          <span className={styles.kicker}>SHIFT ALREADY OPEN</span>
          <strong>{context.existingShift?.cashBoxLabel}</strong>
          <p>Started {context.existingShift?.businessDate}. No duplicate shift will be created.</p>
          <Link href="/mini" className={styles.primaryLink}>BACK TO MY WORKSPACE</Link>
        </section>
      ) : isPaused ? (
        <section className={`${styles.card} ${styles.warningCard}`}>
          <span className={styles.kicker}>SECURED / PAUSED</span>
          <strong>{context.existingShift?.cashBoxLabel}</strong>
          <p>This cash box remains accountable to you. Resume only after it is physically back under your control.</p>
          {submitError ? <div className={styles.errorBox}>{submitError}</div> : null}
          <button
            type="button"
            className={styles.primaryButton}
            disabled={submitting}
            onClick={() => void submit({ operation: "RESUME", shiftId: context.existingShift!.shiftId }, entry)}
          >
            {submitting ? "RESUMING…" : "RESUME THIS CASH BOX"}
          </button>
        </section>
      ) : (
        <>
          <section className={styles.card}>
            <span className={styles.kicker}>OPENING CHANGE FUND</span>
            <strong>{context.openingFund.requiresNewFund ? "New / restart opening fund" : "Own retained change fund"}</strong>
            <p>Source: {context.openingFund.source}</p>
            {!context.openingFund.requiresNewFund ? <div className={styles.amountBanner}>Expected: {money(context.openingFund.expectedAmount)}</div> : null}
            <label className={styles.field}>
              <span>Actual amount physically counted</span>
              <input
                inputMode="decimal"
                value={actualFund}
                onChange={(event) => setActualFund(event.target.value)}
                placeholder="0.00"
                disabled={submitting}
              />
            </label>
            {differs ? (
              <label className={styles.field}>
                <span>Reason for difference</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Short factual explanation" disabled={submitting} />
              </label>
            ) : null}
            <label className={styles.confirmRow}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={submitting} />
              <span>I physically counted and accept this opening fund.</span>
            </label>
          </section>

          {context.preShiftCash.amount > 0 ? (
            <section className={`${styles.card} ${styles.warningCard}`}>
              <span className={styles.kicker}>COMPANY CASH WITH YOU</span>
              <strong>{money(context.preShiftCash.amount)}</strong>
              <p>When this shift opens, the existing recorded company cash will automatically move from your personal/field custody into this cashier drawer. No second sale or collection is created.</p>
            </section>
          ) : null}

          {submitError ? <div className={styles.errorBox}>{submitError}</div> : null}
          <button
            type="button"
            className={styles.primaryButton}
            disabled={submitting || !canStart}
            onClick={() => parsedActual !== null && void submit({
              operation: "START",
              stateFingerprint: context.stateFingerprint,
              actualOpeningFund: parsedActual,
              openingFundConfirmed: true,
              ...(reason.trim() ? { exceptionReason: reason.trim() } : {}),
            }, entry)}
          >
            {submitting ? "OPENING SHIFT…" : "OPEN CASHIER SHIFT"}
          </button>
        </>
      )}
    </AguiMobileShell>
  );
}
