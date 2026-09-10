"use client";

import { useEffect, useState } from "react";

import type {
  MiniAppClosingLoadResponse,
  MiniAppClosingLoadSuccess,
  MiniAppClosingSubmitPayload,
  MiniAppClosingSubmitResponse,
  MiniAppClosingSubmitSuccess,
} from "@/lib/miniapp/types";
import styles from "./closing.module.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        enableClosingConfirmation?: () => void;
        disableClosingConfirmation?: () => void;
        HapticFeedback?: { impactOccurred?: (style: "light" | "medium" | "heavy") => void };
      };
    };
  }
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; data: MiniAppClosingLoadSuccess };

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; code: string; message: string; refreshRequired: boolean; retrySameRequest: boolean; reviewRequired: boolean }
  | { status: "success"; data: MiniAppClosingSubmitSuccess };

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function readMoney(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function waitForTelegramWebApp() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const webApp = window.Telegram?.WebApp;
    if (webApp) return webApp;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return undefined;
}

export default function ClosingClient() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [floorReady, setFloorReady] = useState(false);
  const [sales, setSales] = useState("");
  const [tomorrowFund, setTomorrowFund] = useState("");
  const [finalDrop, setFinalDrop] = useState("");
  const [remarks, setRemarks] = useState("");
  const [checkerId, setCheckerId] = useState("");
  const [checkerMatched, setCheckerMatched] = useState(false);
  const [checksMatched, setChecksMatched] = useState(false);
  const [vaultDone, setVaultDone] = useState(false);

  async function loadContext() {
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    const tg = await waitForTelegramWebApp();
    tg?.ready?.();
    tg?.expand?.();
    const initData = tg?.initData ?? "";
    if (!initData) {
      setLoad({ status: "error", code: "OPEN_FROM_TELEGRAM", message: "Open this End Shift screen from the Agui Telegram bot." });
      return;
    }
    try {
      const response = await fetch("/api/miniapp/closing/context", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const payload = (await response.json()) as MiniAppClosingLoadResponse;
      if (!payload.ok) {
        setLoad({ status: "error", code: payload.code, message: payload.message });
        return;
      }
      if (payload.resume) {
        setFloorReady(true);
        setSales(String(payload.resume.cashierSalesTotal));
        setTomorrowFund(String(payload.resume.tomorrowFund));
        setFinalDrop(String(payload.resume.finalDropCash));
        setRemarks(payload.resume.remarks ?? "");
        setCheckerId(payload.resume.checkerEmployeeId ?? "");
        setCheckerMatched(Boolean(payload.resume.checkerEmployeeId));
        setChecksMatched(payload.resume.checkCount === 0 || payload.resume.checkReferences.length > 0);
        setVaultDone(payload.resume.sealedPacket);
        if (payload.resume.lastErrorMessage) {
          setSubmit({
            status: "error",
            code: payload.resume.lastErrorCode || "PREVIOUS_ATTEMPT",
            message: payload.resume.lastErrorMessage,
            refreshRequired: false,
            retrySameRequest: payload.resume.retrySameRequest,
            reviewRequired: payload.resume.reviewRequired,
          });
        }
      }
      setLoad({ status: "ready", data: payload });
    } catch {
      setLoad({ status: "error", code: "NETWORK_ERROR", message: "Could not load the closing context. Check connection and try again." });
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  function markChanged() {
    window.Telegram?.WebApp?.enableClosingConfirmation?.();
    if (submit.status === "error" && !submit.reviewRequired) setSubmit({ status: "idle" });
  }

  if (load.status === "loading") {
    return <main className={styles.shell}><div className={styles.loading}>Loading your active cash box…</div></main>;
  }

  if (load.status === "error") {
    return (
      <main className={styles.shell}>
        <section className={styles.hero}><div className={styles.eyebrow}>AGUI · VVS OPERATIONS</div><h1>End Shift</h1></section>
        <section className={`${styles.card} ${styles.errorCard}`}><strong>Cannot open closing</strong><p>{load.message}</p><button type="button" className={styles.secondaryButton} onClick={() => void loadContext()}>Refresh</button></section>
      </main>
    );
  }

  if (submit.status === "success") {
    const result = submit.data;
    return (
      <main className={styles.shell}>
        <section className={styles.successCard}>
          <div className={styles.successMark}>✓</div>
          <div className={styles.eyebrow}>AGUI · VVS OPERATIONS</div>
          <h1>Shift Closed</h1>
          <p>{result.cashierName} · {result.branchLabel || result.branch}</p>
        </section>
        <section className={styles.card}>
          <div className={styles.summary}>
            <span>Closing ID</span><strong>{result.closingId}</strong>
            <span>Final Drop</span><strong>{result.finalDropRef || "NONE"}</strong>
            <span>Cash</span><strong>₱{money(result.finalDropCash)}</strong>
            <span>Tomorrow Fund</span><strong>₱{money(result.tomorrowFund)}</strong>
            <span>Checker</span><strong>{result.finalDropCheckerName || "—"}</strong>
            <span>Status</span><strong>{result.cashierResult}</strong>
          </div>
          <p>{result.message}</p>
        </section>
        <button type="button" className={styles.primaryButton} onClick={() => window.Telegram?.WebApp?.close?.()}>DONE</button>
      </main>
    );
  }

  const data = load.data;
  const isSubmitting = submit.status === "submitting";
  const submitReviewRequired = submit.status === "error" && submit.reviewRequired;
  const amountsEnabled = data.preflight.ready && floorReady && !isSubmitting;
  const salesNumber = readMoney(sales);
  const tomorrowFundNumber = readMoney(tomorrowFund);
  const finalDropNumber = readMoney(finalDrop);
  const packetRequired = (finalDropNumber ?? 0) > 0.009 || data.checks.count > 0;
  const checkerEnabled = amountsEnabled && packetRequired;
  const vaultEnabled = checkerEnabled && checkerMatched && Boolean(checkerId) && (data.checks.count === 0 || checksMatched);
  const selectedChecker = data.eligibleCheckers.find((checker) => checker.employeeId === checkerId)?.name ?? "—";
  const amountsValid = salesNumber !== null && tomorrowFundNumber !== null && finalDropNumber !== null;
  const physicalReady = !packetRequired || (Boolean(checkerId) && checkerMatched && (data.checks.count === 0 || checksMatched) && vaultDone);
  const canSubmit = Boolean(data.rules.submitEnabled && data.preflight.ready && floorReady && amountsValid && physicalReady && !isSubmitting && !submitReviewRequired);
  const reservedDropRef = data.finalDropReservation?.finalDropRef ?? "";

  async function submitClosing() {
    if (!canSubmit || salesNumber === null || tomorrowFundNumber === null || finalDropNumber === null) return;
    const tg = await waitForTelegramWebApp();
    const initData = tg?.initData ?? "";
    if (!initData) {
      setSubmit({ status: "error", code: "OPEN_FROM_TELEGRAM", message: "Telegram session data is missing. Close and reopen End Shift from the bot.", refreshRequired: false, retrySameRequest: false, reviewRequired: false });
      return;
    }
    const payload: MiniAppClosingSubmitPayload = {
      requestId: data.requestId,
      shiftId: data.shift.shiftId,
      stateFingerprint: data.stateFingerprint,
      floorReadyConfirmed: true,
      cashierSalesTotal: salesNumber,
      tomorrowFund: tomorrowFundNumber,
      finalDropCash: finalDropNumber,
      remarks,
      checkerEmployeeId: packetRequired ? checkerId : "",
      checkerCountMatched: packetRequired ? checkerMatched : false,
      checksMatched: data.checks.count > 0 ? checksMatched : true,
      envelopeSigned: packetRequired ? vaultDone : false,
      envelopeSealed: packetRequired ? vaultDone : false,
      inDropVault: packetRequired ? vaultDone : false,
      checkCount: data.checks.count,
      checkTotal: data.checks.total,
      checkReferences: data.checks.references,
    };

    setSubmit({ status: "submitting" });
    try {
      const response = await fetch("/api/miniapp/closing/submit", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, payload }),
      });
      const result = (await response.json()) as MiniAppClosingSubmitResponse;
      if (!result.ok) {
        setSubmit({
          status: "error",
          code: result.code,
          message: result.message,
          refreshRequired: Boolean(result.refreshRequired),
          retrySameRequest: Boolean(result.retrySameRequest),
          reviewRequired: Boolean(result.reviewRequired),
        });
        return;
      }
      window.Telegram?.WebApp?.disableClosingConfirmation?.();
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("heavy");
      setSubmit({ status: "success", data: result });
    } catch {
      setSubmit({ status: "error", code: "NETWORK_ERROR", message: "The response was lost or the network failed. Do not create another Drop. Tap RETRY SAME CLOSING; Agui will reuse the same request.", refreshRequired: false, retrySameRequest: true, reviewRequired: false });
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>AGUI · VVS OPERATIONS</div>
        <h1>End Shift</h1>
        <p>{data.rules.submitEnabled ? "one window · blind closing · controlled final submit" : "POC-01 · one window · local edits · LOAD pilot"}</p>
      </section>

      <section className={`${styles.card} ${styles.identityGrid}`}>
        <div><span>Cashier</span><strong>{data.shift.cashierName}</strong></div>
        <div><span>Branch</span><strong>{data.shift.branchLabel || data.shift.branch}</strong></div>
        <div><span>Cash Box</span><strong>{data.shift.cashBoxLabel}</strong></div>
        <div><span>Shift</span><strong>{data.shift.shiftId}</strong></div>
      </section>

      <section className={`${styles.card} ${data.preflight.ready ? styles.readyCard : styles.errorCard}`}>
        <strong>{data.preflight.ready ? "✓ Preflight ready" : "⚠ Cannot close yet"}</strong>
        <p>{data.preflight.ready ? "No blocking closing item was found at load time." : data.preflight.blockMessage}</p>
        {!data.preflight.ready && <button type="button" className={styles.secondaryButton} onClick={() => void loadContext()}>Refresh</button>}
      </section>

      <section className={styles.card}>
        <h2>1 · FLOOR READY</h2>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={floorReady} disabled={!data.preflight.ready || isSubmitting} onChange={(event) => { setFloorReady(event.target.checked); markChanged(); }} />
          <span className={styles.checkList}>{data.floorChecklist.map((item) => <span key={item}>{item}</span>)}</span>
        </label>
      </section>

      <section className={`${styles.card} ${!amountsEnabled ? styles.disabledSection : ""}`}>
        <h2>2 · CLOSING AMOUNTS</h2>
        <label className={styles.field}><span>Cashier Sales Total</span><input inputMode="decimal" disabled={!amountsEnabled} value={sales} onChange={(e) => { setSales(e.target.value); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Tomorrow Change Fund</span><input inputMode="decimal" disabled={!amountsEnabled} value={tomorrowFund} onChange={(e) => { setTomorrowFund(e.target.value); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Final Drop Cash</span><input inputMode="decimal" disabled={!amountsEnabled} value={finalDrop} onChange={(e) => { setFinalDrop(e.target.value); setCheckerMatched(false); setChecksMatched(false); setVaultDone(false); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Remarks</span><textarea disabled={!amountsEnabled} value={remarks} onChange={(e) => { setRemarks(e.target.value); markChanged(); }} placeholder="Optional" /></label>
      </section>

      <section className={`${styles.card} ${!checkerEnabled ? styles.disabledSection : ""}`}>
        <h2>3 · FINAL DROP</h2>
        {data.checks.count > 0 && (
          <div className={styles.notice}>
            <strong>Physical checks: {data.checks.count} · ₱{money(data.checks.total)}</strong>
            {data.checks.items.map((item) => <div key={`${item.reference}-${item.posReference}`}>• {item.displayName} · {item.reference || item.posReference} · ₱{money(item.amount)}</div>)}
          </div>
        )}
        <label className={styles.field}><span>Checker</span><select disabled={!checkerEnabled || isSubmitting} value={checkerId} onChange={(e) => { setCheckerId(e.target.value); setCheckerMatched(false); setChecksMatched(false); setVaultDone(false); markChanged(); }}><option value="">Select independent checker</option>{data.eligibleCheckers.map((checker) => <option key={checker.employeeId} value={checker.employeeId}>{checker.name}{checker.atClosingBranch ? " · here" : checker.location ? ` · ${checker.location}` : ""}</option>)}</select></label>
        <div className={styles.verifyBox}><span>Cash for independent count</span><strong>₱{money(finalDropNumber ?? 0)}</strong></div>
        <button type="button" disabled={!checkerEnabled || !checkerId || isSubmitting} className={styles.secondaryButton} onClick={() => { setCheckerMatched(true); if (data.checks.count === 0) setChecksMatched(true); window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light"); markChanged(); }}>✓ CHECKER COUNT MATCHES</button>
        {data.checks.count > 0 && (
          <label className={styles.checkRow}><input type="checkbox" disabled={!checkerMatched || isSubmitting} checked={checksMatched} onChange={(e) => { setChecksMatched(e.target.checked); setVaultDone(false); markChanged(); }} /><span>Checker matched every physical check to the references above.</span></label>
        )}
        {packetRequired && reservedDropRef && data.rules.submitEnabled && (
          <div className={styles.dropRefBox}><span>DROP REF</span><strong>{reservedDropRef}</strong><small>Write this on the envelope before both people sign and seal it.</small></div>
        )}
        <label className={styles.checkRow}><input type="checkbox" disabled={!vaultEnabled || isSubmitting} checked={vaultDone} onChange={(e) => { setVaultDone(e.target.checked); markChanged(); }} /><span>Both people signed, the envelope was sealed, and it is now inside {data.shift.branchLabel || data.shift.branch} Drop Vault.</span></label>
        <p className={styles.muted}>{data.rules.submitEnabled ? "The reserved Drop Ref belongs to this exact closing request. If submit fails, retry this same request—never create a second envelope." : "Drop Ref will be assigned only by the future controlled submit. This LOAD pilot does not create a Drop."}</p>
      </section>

      <section className={styles.card}>
        <h2>CLOSING SUMMARY</h2>
        <div className={styles.summary}><span>Sales</span><strong>₱{money(salesNumber ?? 0)}</strong><span>Tomorrow Fund</span><strong>₱{money(tomorrowFundNumber ?? 0)}</strong><span>Final Drop</span><strong>₱{money(finalDropNumber ?? 0)}</strong><span>Checker</span><strong>{selectedChecker}</strong>{reservedDropRef && data.rules.submitEnabled && <><span>Drop Ref</span><strong>{reservedDropRef}</strong></>}</div>
      </section>

      {submit.status === "error" && (
        <section className={`${styles.card} ${submit.reviewRequired ? styles.errorCard : styles.warningCard}`}>
          <strong>{submit.reviewRequired ? "⚠ Management review required" : "Closing not completed"}</strong>
          <p>{submit.message}</p>
          {submit.refreshRequired && !vaultDone && <button type="button" className={styles.secondaryButton} onClick={() => void loadContext()}>REFRESH CURRENT STATE</button>}
          {submit.retrySameRequest && !submit.reviewRequired && <p><strong>Use the same Submit again.</strong> Do not make another Drop.</p>}
        </section>
      )}

      <div className={styles.bottomSpacer} />
      <div className={styles.stickyBar}>
        <button type="button" disabled={!canSubmit} className={styles.submitButton} onClick={() => void submitClosing()} title={data.rules.submitEnabled ? "Controlled final commit" : "Disabled in LOAD-only pilot"}>
          {isSubmitting ? "⏳ CLOSING SHIFT… DO NOT TAP AGAIN" : data.rules.submitEnabled ? (submit.status === "error" && submit.retrySameRequest ? "↻ RETRY SAME CLOSING" : "✅ SUBMIT & CLOSE SHIFT") : "✅ SUBMIT & CLOSE SHIFT · LOAD ONLY"}
        </button>
      </div>
    </main>
  );
}
