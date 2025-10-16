"use client";

import * as React from "react";

type Kind = "ok" | "warn" | "err";

export function useToast() {
  const api = React.useMemo(() => {
    function spawn(msg: string, kind: Kind = "ok", ms = 3000) {
      const root = getRoot();
      const el = document.createElement("div");
      el.className = `agui-toast agui-toast--${kind}`;
      el.textContent = msg;
      root.appendChild(el);
      window.setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(4px)";
        setTimeout(() => el.remove(), 250);
      }, ms);
    }
    return {
      success: (m: string) => spawn(m, "ok"),
      warning: (m: string) => spawn(m, "warn"),
      error: (m: string) => spawn(m, "err"),
    };
  }, []);
  return api;
}

function getRoot() {
  let root = document.getElementById("agui-toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "agui-toast-root";
    document.body.appendChild(root);
  }
  return root;
}

export function ToasterMount() {
  return <div id="agui-toast-root" aria-live="polite" aria-atomic="true" />;
}
