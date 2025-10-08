"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";

/* ========= Types ========= */
export type Column<T> = {
  key: keyof T | string;
  header: string;
  width?: string; // e.g., "120px" or "20%"
  align?: "left" | "center" | "right";
  render?: (row: T, rowIndex: number) => ReactNode;
};

export type TableState = {
  page: number; // 1-based
  pageSize: number;
  total: number; // total rows (server-side)
  density?: "dense" | "comfortable";
  loading?: boolean;
  error?: string | null;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  state: TableState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  getRowId?: (row: T, index: number) => string;
  emptyMessage?: string;
};

/* ========= Helpers ========= */
function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* Focus grid keyboard navigation */
function useGridNav(ref: React.RefObject<HTMLTableSectionElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (!target || target.getAttribute("data-cell") !== "1") return;

      const row = Number(target.getAttribute("data-row") || "0");
      const col = Number(target.getAttribute("data-col") || "0");

      function focusCell(r: number, c: number) {
        // ✅ Guard: el can be null between renders
        if (!el) return;
        const next = el.querySelector<HTMLElement>(
          `[data-row="${r}"][data-col="${c}"][data-cell="1"]`,
        );
        if (next) next.focus();
      }

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          focusCell(row, col + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (col > 0) focusCell(row, col - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          focusCell(row + 1, col);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (row > 0) focusCell(row - 1, col);
          break;
        case "Home":
          e.preventDefault();
          focusCell(row, 0);
          break;
        case "End":
          e.preventDefault();
          const last =
            (el.querySelectorAll(`[data-row="${row}"][data-cell="1"]`) || [])
              .length - 1;
          focusCell(row, last);
          break;
      }
    }

    el.addEventListener("keydown", handleKey);
    return () => el.removeEventListener("keydown", handleKey);
  }, [ref]);
}

/* ========= Component ========= */
export function DataTable<T extends Record<string, unknown>>(props: Props<T>) {
  const {
    columns,
    rows,
    state,
    onPageChange,
    onPageSizeChange,
    getRowId,
    emptyMessage = "No data to show.",
  } = props;

  const {
    page,
    pageSize,
    total,
    density = "comfortable",
    loading,
    error,
  } = state;

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useGridNav(tbodyRef);

  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const sizes = useMemo(
    () => ({
      rowPad: density === "dense" ? "py-2" : "py-3",
      text: density === "dense" ? "text-sm" : "text-base",
    }),
    [density],
  );

  return (
    <div className="w-full bg-card text-card-foreground rounded-2xl shadow-soft">
      {/* Table container */}
      <div className="overflow-auto rounded-2xl">
        <table className={cls("w-full", sizes.text)}>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              {columns.map((c, i) => (
                <th
                  key={String(c.key) + i}
                  className={cls("text-left font-medium px-3", sizes.rowPad)}
                  style={{
                    width: c.width,
                    textAlign: c.align ?? "left",
                  }}
                  scope="col"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Loading / Error / Empty overlays */}
          {loading ? (
            <tbody>
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            </tbody>
          ) : error ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-danger/10 text-danger px-4 py-2">
                    {error}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : rows.length === 0 ? (
            <tbody>
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody ref={tbodyRef}>
              {rows.map((row, rIndex) => (
                <tr
                  key={getRowId ? getRowId(row, rIndex) : rIndex}
                  className={cls(
                    "border-b border-border/70 hover:bg-muted/60 transition-colors",
                    sizes.rowPad,
                  )}
                >
                  {columns.map((c, cIndex) => (
                    <td
                      key={String(c.key) + cIndex}
                      className={cls(
                        "px-3 align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                      )}
                      style={{
                        width: c.width,
                        textAlign: c.align ?? "left",
                      }}
                      tabIndex={0}
                      data-cell="1"
                      data-row={rIndex}
                      data-col={cIndex}
                    >
                      {c.render
                        ? c.render(row, rIndex)
                        : String(row[c.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Footer: pagination + density */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <select
            className="border border-input bg-background rounded-xl px-2 py-1"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="ml-3">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{" "}
            {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost px-3 py-1"
            onClick={() => onPageChange?.(1)}
            disabled={page <= 1}
            aria-label="First page"
          >
            «
          </button>
          <button
            className="btn btn-ghost px-3 py-1"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-sm tabular-nums">
            {page} / {pageCount}
          </span>
          <button
            className="btn btn-ghost px-3 py-1"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            className="btn btn-ghost px-3 py-1"
            onClick={() => onPageChange?.(pageCount)}
            disabled={page >= pageCount}
            aria-label="Last page"
          >
            »
          </button>

          <div className="ml-2 hidden sm:flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Density:</span>
            <span className="px-2 py-1 rounded-lg bg-muted">
              {state.density ?? "comfortable"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
