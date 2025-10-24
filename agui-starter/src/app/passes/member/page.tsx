import { getSupabase } from "@/lib/supabase";
import { getCurrentEntity } from "@/lib/auth/entity";
import { ensureScheme } from "@/lib/loyalty/rules";
import { ensureCard } from "@/lib/passes/cards";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function MemberPassPage() {
  const db = getSupabase();
  const ent = await getCurrentEntity();
  if (!db || !ent) {
    return <div className="text-sm text-muted-foreground">Sign in to view your pass.</div>;
  }

  const scheme = await ensureScheme("GUILD", "Guild Card", 2);
  const card = await ensureCard(scheme.id, ent.id, { incognitoDefault: false });

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">Your Pass</div>
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="text-sm">Card ID: <span className="font-mono">{card.id.slice(0,8)}…</span></div>
          {/* token will be fetched/rotated client-side */}
          <RotateClient cardId={card.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function RotateClient({ cardId }: { cardId: string }) {
  return (
    <form action="/api/passes/rotate" method="post" className="space-y-2">
      <input type="hidden" name="cardId" value={cardId} />
      <Button type="submit" variant="outline">Rotate QR Token</Button>
      <div className="text-xs text-muted-foreground">After rotation, the new raw token is returned by the API (dev only).</div>
    </form>
  );
}
