export function HrAccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
      <div className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
