"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  photoUrl: string;
  fullName: string;
};

export function EmployeePhotoPreview({ photoUrl, fullName }: Props) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown as EventListener);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown as EventListener);
    };
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (!focusables || focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        type="button"
        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
        aria-label={`Preview ${fullName} photo`}
      >
        <img
          src={photoUrl}
          alt={`${fullName} photo`}
          className="h-28 w-28 shrink-0 rounded-xl border border-border object-cover sm:h-24 sm:w-24 lg:h-20 lg:w-20"
        />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${fullName} photo preview`}>
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close photo preview"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              ref={panelRef}
              className="w-[min(92vw,420px)] rounded-xl border border-border bg-card p-3 shadow-2xl"
              onKeyDown={onPanelKeyDown}
            >
              <div className="mb-3 flex justify-end">
                <Button
                  ref={closeButtonRef}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Close photo preview"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
              <img
                src={photoUrl}
                alt={`${fullName} full-size photo`}
                className="h-auto max-h-[80vh] w-full rounded-md object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
