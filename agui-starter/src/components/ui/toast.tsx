"use client";

import { useEffect } from "react";

export function Toast({
  kind = "success",
  message,
  onClose,
}: {
  kind?: "success" | "error";
  message: string;
  onClose?: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(), 2000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] rounded-xl px-4 py-2 shadow-lifted
        ${kind === "success" ? "bg-success/90 text-white" : "bg-danger/90 text-white"}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
