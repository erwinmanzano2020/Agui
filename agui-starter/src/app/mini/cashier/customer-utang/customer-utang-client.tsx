"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AguiMobileShell from "@/components/mobile/agui-mobile-shell";
import {
  filterCustomerUtangCustomers,
  type CustomerUtangContextResponse,
  type CustomerUtangContextSuccess,
} from "@/lib/mobile/customer-utang";
import { resolveAguiMobileEntry, type AguiMobileEntry } from "@/lib/mobile/entry";
import styles from "./customer-utang.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string; code?: string; staleShift: boolean }
  | { status: "ready"; context: CustomerUtangContextSuccess; entry: AguiMobileEntry };

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Not available";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
}

async function loadContext(entry: AguiMobileEntry) {
  const response = await fetch("/api/miniapp/cashier/customer-utang/context", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: entry.telegramInitData }),
  });
  return (await response.json()) as CustomerUtangContextResponse;
}

export default function CustomerUtangClient() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [saleReference, setSaleReference] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setState({ status: "loading" });
    try {
      const entry = await resolveAguiMobileEntry(window);
      const result = await loadContext(entry);
      if (!result.ok) {
        const staleShift = result.state === "STALE_PREVIOUS_DAY_SHIFT" || result.code === "STALE_PREVIOUS_DAY_SHIFT" || result.code === "STALE_SHIFT";
        setState({ status: "error", message: result.message, code: result.code, staleShift });
        return;
      }
      setState({ status: "ready", context: result, entry });
    } catch {
      setState({ status: "error", message: "Could not load Customer Utang. Check connection and try again.", staleShift: false });
    }
  }

  useEffect(() => { void load(); }, []);

  const customers = useMemo(() => state.status === "ready" ? state.context.customers : [], [state]);
  const filteredCustomers = useMemo(() => filterCustomerUtangCustomers(customers, search), [customers, search]);
  const selectedCustomer = customers.find((customer) => customer.customerId === customerId) ?? null;
  const parsedAmount = Number(amount.replace(/,/g, "").trim());
  const previewAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? money(parsedAmount) : "₱0.00";

  if (state.status === "loading") {
    return (
      <AguiMobileShell title="Customer Utang" subtitle="Loading verified cashier context…">
        <section className={styles.card}><strong>Checking current shift and customers…</strong><p>No transaction is being recorded.</p></section>
      </AguiMobileShell>
    );
  }

  if (state.status === "error") {
    return (
      <AguiMobileShell title="Customer Utang" subtitle="Cashier access check">
        <section className={`${styles.card} ${styles.errorCard}`}>
          <span className={styles.kicker}>{state.staleShift ? "STALE SHIFT RECOVERY REQUIRED" : "CANNOT LOAD CONTEXT"}</span>
          <strong>{state.message}</strong>
          {state.staleShift ? <p>Recover or close the previous-day shift before using today&apos;s Customer Utang screen.</p> : null}
          {state.code ? <p>Code: {state.code}</p> : null}
          <button type="button" className={styles.secondaryButton} onClick={() => void load()}>TRY AGAIN</button>
          <Link href="/mini" className={styles.linkButton}>BACK TO MY WORKSPACE</Link>
        </section>
      </AguiMobileShell>
    );
  }

  const { context, entry } = state;
  return (
    <AguiMobileShell
      title="Customer Utang"
      subtitle={`${context.actor.employeeName} · ${context.branch.code}`}
      badge={<span className={styles.modeBadge}>{entry.launchMode === "telegram" ? "TELEGRAM" : "DIRECT"}</span>}
      footer="Gate 1 is context-only. Apps Script and Google Sheets remain authoritative."
    >
      <section className={`${styles.card} ${styles.identityCard}`}>
        <span className={styles.kicker}>VERIFIED CASHIER CONTEXT</span>
        <strong>{context.actor.employeeName}</strong>
        <dl className={styles.grid}>
          <div><dt>Branch</dt><dd>{context.branch.label}</dd></div>
          <div><dt>Cash box / station</dt><dd>{context.shift.cashBoxLabel || context.shift.station}</dd></div>
          <div><dt>Shift</dt><dd>{context.shift.shiftId}</dd></div>
          <div><dt>Business date</dt><dd>{context.shift.businessDate}</dd></div>
        </dl>
      </section>

      <section className={styles.card}>
        <span className={styles.kicker}>CUSTOMER UTANG DETAILS</span>
        <label className={styles.field}>
          <span>Find approved active customer</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or customer ID" autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span>Customer</span>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Select customer</option>
            {filteredCustomers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.officialName}</option>)}
          </select>
        </label>
        <p className={styles.fallback}>Customer not listed? Use the existing Customer Request / Telegram fallback. Masterlist approval is not automatic credit approval.</p>
        <label className={styles.field}>
          <span>Amount (PHP)</span>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </label>
        <label className={styles.field}>
          <span>POS SI / Sale Reference <b>Required</b></span>
          <input value={saleReference} onChange={(event) => setSaleReference(event.target.value)} placeholder="Enter POS receipt or sale reference" />
        </label>
        <label className={styles.field}>
          <span>Optional note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Short factual note" />
        </label>
      </section>

      {selectedCustomer ? (
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <span className={styles.kicker}>CUSTOMER SUMMARY</span>
          <strong>{selectedCustomer.officialName}</strong>
          <dl className={styles.grid}>
            <div><dt>Current A/R</dt><dd>{money(selectedCustomer.currentAR)}</dd></div>
            <div><dt>Collection terms</dt><dd>{selectedCustomer.collectionTerms}</dd></div>
            <div><dt>Due date</dt><dd>{selectedCustomer.dueDate}</dd></div>
            <div><dt>Default due days</dt><dd>{selectedCustomer.defaultDueDays}</dd></div>
          </dl>
        </section>
      ) : null}

      <section className={`${styles.card} ${styles.previewCard}`}>
        <span className={styles.kicker}>READ-ONLY TRANSACTION PREVIEW</span>
        <strong>Will add {previewAmount} to Customer A/R</strong>
        <p>Will reduce expected cashier cash by {previewAmount}.</p>
        <p>The sale remains recorded in POS. No duplicate sale/revenue will be created.</p>
      </section>

      <section className={`${styles.card} ${styles.paperCard}`}>
        <span className={styles.kicker}>PAPER WORKFLOW — AFTER RECORDING IS ENABLED</span>
        <p>After Agui records this transaction, write the generated AGUI Ref on the matching Customer Utang logbook/credit slip and complete/sign the paper.</p>
      </section>

      <button type="button" className={styles.disabledButton} disabled>RECORD UTANG — ENABLE AFTER GATE 1</button>
    </AguiMobileShell>
  );
}
