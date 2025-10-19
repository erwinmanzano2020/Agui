"use client";

const PREVIEW_ITEMS = [
  { label: "Directory", glyph: "📇" },
  { label: "Bookings", glyph: "🗓️" },
  { label: "Payroll", glyph: "💵" },
  { label: "Insights", glyph: "📊" },
  { label: "Inventory", glyph: "📦" },
  { label: "Messages", glyph: "💬" },
];

export default function ThemePreview() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
      {PREVIEW_ITEMS.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2">
          <div className="icon-tile flex h-[60px] w-[60px] items-center justify-center text-2xl" aria-hidden>
            <span>{item.glyph}</span>
          </div>
          <span className="text-[13px] font-medium tracking-wide" style={{ color: "var(--tile-label)" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
