"use client";

import { useEffect, useState } from "react";

import type {
  DirectDeviceContext,
  DirectDeviceContextResponse,
  DirectLoginResponse,
  DirectLogoutResponse,
  DirectSessionResponse,
  DirectStaffSession,
} from "@/lib/mobile/direct-auth";
import styles from "./direct-sign-in.module.css";

const SAVED_DEVICE_KEY = "agui_mobile_device_id";

type Props = {
  onSessionChange?: (session: DirectStaffSession | null) => void;
};

type BusyState = "session" | "device" | "login" | "logout" | null;

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await response.json()) as T;
}

export default function DirectSignIn({ onSessionChange }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [device, setDevice] = useState<DirectDeviceContext | null>(null);
  const [session, setSession] = useState<DirectStaffSession | null>(null);
  const [busy, setBusy] = useState<BusyState>("session");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedDevice = window.localStorage.getItem(SAVED_DEVICE_KEY) ?? "";
    if (savedDevice) setDeviceId(savedDevice);

    let cancelled = false;
    void postJson<DirectSessionResponse>("/api/miniapp/direct/session")
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSession(result.session);
          setDeviceId(result.session.deviceId);
          onSessionChange?.(result.session);
        } else if (result.code !== "DIRECT_SESSION_MISSING") {
          setMessage(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not check the direct staff session. Check connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [onSessionChange]);

  async function checkDevice() {
    if (busy) return;
    setBusy("device");
    setMessage("");
    setDevice(null);
    try {
      const result = await postJson<DirectDeviceContextResponse>("/api/miniapp/direct/context", { deviceId });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setDevice(result.device);
      setDeviceId(result.device.deviceId);
      window.localStorage.setItem(SAVED_DEVICE_KEY, result.device.deviceId);
    } catch {
      setMessage("Could not check this device. Check connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function signIn() {
    if (busy || !device) return;
    setBusy("login");
    setMessage("");
    try {
      const result = await postJson<DirectLoginResponse>("/api/miniapp/direct/login", {
        deviceId: device.deviceId,
        employeeId,
        pin,
      });
      setPin("");
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSession(result.session);
      setEmployeeId(result.session.employeeId);
      onSessionChange?.(result.session);
    } catch {
      setPin("");
      setMessage("Could not sign in. Check connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy("logout");
    setMessage("");
    try {
      const result = await postJson<DirectLogoutResponse>("/api/miniapp/direct/logout");
      setSession(null);
      setPin("");
      onSessionChange?.(null);
      if (!result.ok && result.code !== "DIRECT_SESSION_MISSING") setMessage(result.message);
    } catch {
      setSession(null);
      setPin("");
      onSessionChange?.(null);
      setMessage("Signed out locally. Agui could not confirm the upstream session closure.");
    } finally {
      setBusy(null);
    }
  }

  if (busy === "session") {
    return (
      <section className={styles.card}>
        <span className={styles.kicker}>DIRECT STAFF SESSION</span>
        <strong>Checking this browser…</strong>
        <p>Agui is checking for an existing verified shared-device session.</p>
      </section>
    );
  }

  if (session) {
    return (
      <section className={`${styles.card} ${styles.signedInCard}`}>
        <span className={styles.kicker}>DIRECT STAFF SESSION</span>
        <div className={styles.sessionHeading}>
          <div>
            <strong>{session.employeeName}</strong>
            <p>{session.employeeId} · {session.roleUsed}</p>
          </div>
          <span className={styles.verifiedBadge}>PIN VERIFIED</span>
        </div>
        <dl className={styles.sessionGrid}>
          <div><dt>Device</dt><dd>{session.deviceLabel}</dd></div>
          <div><dt>Branch</dt><dd>{session.branch || "—"}</dd></div>
          <div><dt>Station</dt><dd>{session.station || "—"}</dd></div>
          <div><dt>Session</dt><dd>{session.sessionId}</dd></div>
        </dl>
        <p className={styles.guardNote}>Identity is verified, but no new operational action is unlocked by this POC.</p>
        {message ? <div className={styles.errorBox}>{message}</div> : null}
        <button type="button" className={styles.secondaryButton} disabled={busy === "logout"} onClick={() => void signOut()}>
          {busy === "logout" ? "SIGNING OUT…" : "SIGN OUT / SWITCH STAFF"}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <span className={styles.kicker}>DIRECT SIGN-IN · POC</span>
      <strong>Shared device → Employee ID → Staff PIN</strong>
      <p>Direct sign-in reuses the existing VVS shared-device staff-session model. Device ID is context, not proof of identity; Staff PIN verification must happen upstream.</p>

      <div className={styles.step}>
        <span className={styles.stepNumber}>1</span>
        <div className={styles.stepBody}>
          <label className={styles.field}>
            <span>Agui Device ID</span>
            <input
              value={deviceId}
              disabled={Boolean(busy)}
              onChange={(event) => { setDeviceId(event.target.value); setDevice(null); }}
              placeholder="DEV-COMP-…"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          <button type="button" className={styles.secondaryButton} disabled={Boolean(busy) || !deviceId.trim()} onClick={() => void checkDevice()}>
            {busy === "device" ? "CHECKING DEVICE…" : "CHECK DEVICE"}
          </button>
        </div>
      </div>

      {device ? (
        <div className={styles.deviceReady}>
          <strong>✓ {device.deviceLabel}</strong>
          <span>{device.defaultBranch || "No branch default"}{device.defaultStation ? ` · ${device.defaultStation}` : ""}</span>
        </div>
      ) : null}

      <div className={`${styles.step} ${!device ? styles.disabledStep : ""}`}>
        <span className={styles.stepNumber}>2</span>
        <div className={styles.stepBody}>
          <label className={styles.field}>
            <span>Employee ID</span>
            <input
              value={employeeId}
              disabled={!device || Boolean(busy)}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="E010"
              autoCapitalize="characters"
              autoComplete="username"
            />
          </label>
          <label className={styles.field}>
            <span>Staff PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              disabled={!device || Boolean(busy)}
              onChange={(event) => setPin(event.target.value)}
              placeholder="••••"
              autoComplete="current-password"
            />
          </label>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!device || Boolean(busy) || !employeeId.trim() || !pin.trim()}
            onClick={() => void signIn()}
          >
            {busy === "login" ? "VERIFYING…" : "VERIFY & SIGN IN"}
          </button>
        </div>
      </div>

      {message ? <div className={styles.errorBox}>{message}</div> : null}
      <p className={styles.securityNote}>Staff PIN is sent only to the server for verification. It is never saved in browser storage or in the Agui session cookie.</p>
    </section>
  );
}
