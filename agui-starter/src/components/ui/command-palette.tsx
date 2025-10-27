"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { Command } from "@/config/commands";
import { canWithRoles, getMyRoles } from "@/lib/authz";
import { useSession } from "@/lib/auth/session-context";

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
  const baseId = useId();
  const listId = `${baseId}-options`;
  const { supabase, user } = useSession();
  const signedIn = Boolean(user);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!supabase || !signedIn) {
        if (!cancelled) {
          setFilteredCommands([]);
        }
        return;
      }

      try {
        const roles = await getMyRoles(supabase);
        if (cancelled) return;

        setFilteredCommands(
          commands.filter((command) =>
            command.feature ? canWithRoles(roles, command.feature) : true,
          ),
        );
      } catch (error) {
        console.warn("Failed to resolve command access", error);
        if (!cancelled) {
          setFilteredCommands([]);
        }
      }
    };

    load().catch((error) => {
      console.error("Failed to initialize command palette roles", error);
      if (!cancelled) {
        setFilteredCommands([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [commands, signedIn, supabase]);

  useEffect(() => {
    if (filteredCommands.length === 0 && open) {
      setOpen(false);
    }
  }, [filteredCommands.length, open]);

  // open with ⌘/Ctrl+K — also '/' like Brave
  useKeybind(
    (e) => {
      if (filteredCommands.length === 0) return false;
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
  const baseCommands = filteredCommands;
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = baseCommands;
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
  }, [baseCommands, q]);

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

  const activeOption = results[activeIndex];
  const activeOptionId = activeOption ? `${baseId}-option-${activeOption.id}` : undefined;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        className="mx-auto mt-24 w-[min(780px,92vw)] rounded-2xl bg-card text-card-foreground shadow-2xl border border-border overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
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
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            className="flex-1 bg-transparent outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          <kbd className="text-xs text-muted-foreground">Esc</kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          className="max-h-[60vh] overflow-auto"
          aria-label="Command results"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No results</div>
          ) : (
            results.map((c, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={c.id}
                  id={`${baseId}-option-${c.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  tabIndex={-1}
                  className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                    isActive ? "bg-muted/80" : "hover:bg-muted/60"
                  }`}
                  onClick={() => onRun(c)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onFocus={() => setActiveIndex(idx)}
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
