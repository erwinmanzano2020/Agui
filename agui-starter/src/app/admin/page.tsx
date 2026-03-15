import { requireGM } from "@/lib/identity/entity";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireGM();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Game Master Console</h1>
      <p className="text-sm text-muted-foreground">
        You have platform role <code>game_master</code>. From here we’ll add seeds, flags, and org tools.
      </p>
    </div>
  );
}
