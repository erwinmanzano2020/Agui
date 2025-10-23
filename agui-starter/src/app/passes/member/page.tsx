import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { loadUiTerms } from "@/lib/ui-terms";
import { getSupabase } from "@/lib/supabase";
import { getCurrentEntity } from "@/lib/auth/entity";
import { ensureMemberPassScheme } from "@/lib/loyalty/schemes-server";
import { ensureLoyaltyProfile } from "@/lib/loyalty/rules";
import { issueCard, loadCardsForEntity, rotateCardToken, type CardWithScheme } from "@/lib/passes/cards";
import { generatePseudoQrMatrix } from "@/lib/passes/qr";

import { MemberPassCard } from "./member-pass-card";
import { INITIAL_MEMBER_PASS_STATE, type MemberPassState } from "./state";

function sortByPrecedence(cards: CardWithScheme[]): CardWithScheme[] {
  return [...cards].sort((a, b) => {
    if (a.scheme.precedence !== b.scheme.precedence) {
      return a.scheme.precedence - b.scheme.precedence;
    }
    return a.scheme.name.localeCompare(b.scheme.name);
  });
}

export default async function MemberPassPage() {
  const terms = await loadUiTerms();
  const memberPassLabel = terms.alliance_pass;

  let supabase;
  let supabaseError: string | null = null;
  try {
    supabase = getSupabase();
  } catch {
    supabase = null;
    supabaseError = "Supabase isn’t configured, so tokens can’t be issued yet.";
  }

  if (!supabase) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{memberPassLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Configure Supabase to start issuing passes and rotating QR tokens.
          </p>
        </header>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {supabaseError}
          </CardContent>
        </Card>
      </div>
    );
  }

  const entity = await getCurrentEntity({ supabase });
  if (!entity) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{memberPassLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to view and rotate your Member Pass token.
          </p>
        </header>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Use your alliance login to access this page and manage your pass.
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheme = await ensureMemberPassScheme({ supabase, displayName: memberPassLabel });
  const cards = await loadCardsForEntity(entity.id, { supabase });

  let memberCard = cards.find((card) => card.scheme.id === scheme.id) ?? null;
  if (!memberCard) {
    memberCard = await issueCard({
      supabase,
      scheme,
      entityId: entity.id,
      incognitoDefault: scheme.allow_incognito,
    });
  }

  const otherCards = sortByPrecedence(cards.filter((card) => card.id !== memberCard.id));

  try {
    await ensureLoyaltyProfile({
      schemeId: scheme.id,
      entityId: entity.id,
      accountNo: memberCard.card_no,
    });
  } catch (error) {
    console.warn("Failed to ensure loyalty profile while rendering Member Pass", error);
  }

  let initialState: MemberPassState = INITIAL_MEMBER_PASS_STATE;
  try {
    const rotation = await rotateCardToken(memberCard.id, "qr", { supabase });
    initialState = {
      status: "success",
      token: rotation.token,
      matrix: generatePseudoQrMatrix(rotation.token),
      message: null,
    } satisfies MemberPassState;
  } catch (error) {
    console.warn("Failed to pre-rotate member pass token", error);
    initialState = {
      status: "error",
      token: null,
      matrix: [],
      message: "We couldn’t generate a QR token yet. Try rotating manually.",
    } satisfies MemberPassState;
  }

  const incognitoDefault = memberCard.flags.incognito_default ?? false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Alliance credential</p>
        <h1 className="text-3xl font-semibold text-foreground">{memberPassLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Present this pass at any guild or company. Rotate your QR token whenever you need a fresh scan.
        </p>
      </header>

      <MemberPassCard
        cardId={memberCard.id}
        cardNo={memberCard.card_no}
        schemeName={scheme.name}
        incognitoDefault={incognitoDefault}
        initialState={initialState}
      />

      {incognitoDefault ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Incognito mode is on</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cross-scope details stay hidden while incognito is active. Staff can temporarily lift incognito during scans
              when needed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Linked passes</h2>
            <p className="text-sm text-muted-foreground">
              These credentials share the same entity so they can inherit roles and loyalty benefits.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {otherCards.length === 0 && <p>No other passes issued yet.</p>}
            {otherCards.length > 0 && (
              <ul className="space-y-2">
                {otherCards.map((card) => (
                  <li key={card.id} className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{card.scheme.name}</span>
                    <span className="text-xs text-muted-foreground">Card number {card.card_no}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <footer className="text-xs text-muted-foreground">
        Need help rotating a QR token for a teammate? Visit their profile from the guild roster.
      </footer>
    </div>
  );
}
