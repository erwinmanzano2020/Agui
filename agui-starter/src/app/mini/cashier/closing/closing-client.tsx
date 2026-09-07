"use client";

import { useEffect, useState } from "react";

import type { MiniAppClosingLoadResponse, MiniAppClosingLoadSuccess } from "@/lib/miniapp/types";
import styles from "./closing.module.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
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

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
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
  const [floorReady, setFloorReady] = useState(false);
  const [sales, setSales] = useState("");
  const [tomorrowFund, setTomorrowFund] = useState("");
  const [finalDrop, setFinalDrop] = useState("");
  const [remarks, setRemarks] = useState("");
  const [checkerId, setCheckerId] = useState("");
  const [checkerMatched, setCheckerMatched] = useState(false);
  const [vaultDone, setVaultDone] = useState(false);

  async function loadContext() {
    setLoad({ status: "loading" });
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

  const data = load.data;
  const amountsEnabled = data.preflight.ready && floorReady;
  const finalDropNumber = Number(finalDrop.replace(/,/g, "")) || 0;
  const packetRequired = finalDropNumber > 0.009 || data.checks.count > 0;
  const checkerEnabled = amountsEnabled && packetRequired;
  const vaultEnabled = checkerEnabled && checkerMatched && Boolean(checkerId);
  const selectedChecker = data.eligibleCheckers.find((checker) => checker.employeeId === checkerId)?.name ?? "—";

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>AGUI · VVS OPERATIONS</div>
        <h1>End Shift</h1>
        <p>POC-01 · one window · local edits · LOAD pilot</p>
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
          <input
            type="checkbox"
            checked={floorReady}
            disabled={!data.preflight.ready}
            onChange={(event) => { setFloorReady(event.target.checked); markChanged(); }}
          />
          <span>{data.floorChecklist.join(" ")}</span>
        </label>
      </section>

      <section className={`${styles.card} ${!amountsEnabled ? styles.disabledSection : ""}`}>
        <h2>2 · CLOSING AMOUNTS</h2>
        <label className={styles.field}><span>Cashier Sales Total</span><input inputMode="decimal" disabled={!amountsEnabled} value={sales} onChange={(e) => { setSales(e.target.value); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Tomorrow Change Fund</span><input inputMode="decimal" disabled={!amountsEnabled} value={tomorrowFund} onChange={(e) => { setTomorrowFund(e.target.value); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Final Drop Cash</span><input inputMode="decimal" disabled={!amountsEnabled} value={finalDrop} onChange={(e) => { setFinalDrop(e.target.value); setCheckerMatched(false); setVaultDone(false); markChanged(); }} placeholder="0.00" /></label>
        <label className={styles.field}><span>Remarks</span><textarea disabled={!amountsEnabled} value={remarks} onChange={(e) => { setRemarks(e.target.value); markChanged(); }} placeholder="Optional" /></label>
      </section>

      <section className={`${styles.card} ${!checkerEnabled ? styles.disabledSection : ""}`}>
        <h2>3 · FINAL DROP</h2>
        {data.checks.count > 0 && <div className={styles.notice}>Physical checks on this shift: <strong>{data.checks.count}</strong> · ₱{money(data.checks.total)}</div>}
        <label className={styles.field}><span>Checker</span><select disabled={!checkerEnabled} value={checkerId} onChange={(e) => { setCheckerId(e.target.value); setCheckerMatched(false); setVaultDone(false); markChanged(); }}><option value="">Select independent checker</option>{data.eligibleCheckers.map((checker) => <option key={checker.employeeId} value={checker.employeeId}>{checker.name}{checker.atClosingBranch ? " · here" : checker.location ? ` · ${checker.location}` : ""}</option>)}</select></label>
        <div className={styles.verifyBox}><span>Cash for independent count</span><strong>₱{money(finalDropNumber)}</strong></div>
        <button type="button" disabled={!checkerEnabled || !checkerId} className={styles.secondaryButton} onClick={() => { setCheckerMatched(true); window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light"); markChanged(); }}>✓ CHECKER COUNT MATCHES</button>
        <label className={styles.checkRow}><input type="checkbox" disabled={!vaultEnabled} checked={vaultDone} onChange={(e) => { setVaultDone(e.target.checked); markChanged(); }} /><span>Signed, sealed, and placed inside {data.shift.branchLabel || data.shift.branch} Drop Vault.</span></label>
        <p className={styles.muted}>Drop Ref will be assigned only by the future controlled submit. This LOAD pilot does not create a Drop.</p>
      </section>

      <section className={styles.card}>
        <h2>CLOSING SUMMARY</h2>
        <div className={styles.summary}><span>Sales</span><strong>₱{money(Number(sales.replace(/,/g, "")) || 0)}</strong><span>Tomorrow Fund</span><strong>₱{money(Number(tomorrowFund.replace(/,/g, "")) || 0)}</strong><span>Final Drop</span><strong>₱{money(finalDropNumber)}</strong><span>Checker</span><strong>{selectedChecker}</strong></div>
      </section>

      <div className={styles.bottomSpacer} />
      <div className={styles.stickyBar}>
        <button type="button" disabled className={styles.submitButton}>✅ Submit & Close Shift · not enabled in LOAD pilot</button>
      </div>
    </main>
  );
}
