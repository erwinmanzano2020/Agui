"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { Command } from "@/config/commands";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (target as HTMLInputElement).type === "search"
  );
}

function useKeybind(combo: (e: KeyboardEvent) => boolean, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (combo(e)) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler]);
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // open with ⌘/Ctrl+K — also '/' like Brave
  useKeybind(
    (e) => {
      if (isEditableTarget(e.target)) return false;
      const key = e.key.toLowerCase();
      if (key === "k" && (e.metaKey || e.ctrlKey)) return true;
      if (key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) return true;
      return false;
    },
    () => setOpen(true)
  );
  // close with Esc
  useKeybind((e) => e.key === "Escape", () => setOpen(false));

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ("");
    }
  }, [open]);

  // simple fuzzy-ish filter
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = commands;
    if (!needle) return base.slice(0, 30);
    return base
      .map((c) => ({
        score: score(c.label + " " + (c.keywords || "") + " " + (c.hint || ""), needle),
        cmd: c,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.cmd);
  }, [q, commands]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [q, results.length]);

  function onRun(c: Command) {
    setOpen(false);
    if (c.run) c.run();
    if (c.href) router.push(c.href);
  }

  function handleKeyNavigation(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) onRun(chosen);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40" onClick={() => setOpen(false)}>
      <div
        className="mx-auto mt-24 w-[min(780px,92vw)] rounded-2xl bg-card text-card-foreground shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span>🔎</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent outline-none"
          />
          <kbd className="text-xs text-muted-foreground">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No results</div>
          ) : (
            results.map((c, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={c.id}
                  className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${
                    isActive ? "bg-muted/80" : "hover:bg-muted/60"
                  }`}
                  onClick={() => onRun(c)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">{c.label}</div>
                    {(c.shortcut || c.hint) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {c.shortcut
                          ? c.shortcut.split(" ").map((k, i) => (
                              <kbd
                                key={i}
                                className="inline-block rounded bg-muted px-1.5 py-0.5"
                              >
                                {k}
                              </kbd>
                            ))
                          : c.hint && <span className="whitespace-nowrap">{c.hint}</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* tiny scorer: returns >0 if 'needle' chars appear in order inside 'haystack' */
function score(haystack: string, needle: string) {
  haystack = haystack.toLowerCase();
  let i = 0, s = 0;
  for (const ch of haystack) {
    if (i < needle.length && ch === needle[i]) {
      i++; s += 2;
    } else if (needle.includes(ch)) {
      s += 1;
    }
  }
  return i === needle.length ? s : 0;
}
