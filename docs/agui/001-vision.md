Agui x Erwin — Brainstorm & Decisions (Oct 7, 2025)
Purpose: Capture realizations, pick the top 3 priorities, and lock concrete next actions we can start now.

0) Ground Rules (quick!)
Keep it punchy, Taglish ok.
Default to ship small, daily.
If something takes > 1 hour, we slice it smaller.
Decisions logged below; change needs a new decision entry.

1) Your Realizations (dump here)
Paste bullets as-is. I’ll triage.
[ ]
[ ]
[ ]
[ ]
[ ]
Prompt ideas (optional):
Ano ‘yung pinaka-nakakapagod/nakaka-delay sa araw mo ngayon?
Ano ang mga “almost there” na features na kailan lang ng one clear push?
Ano ang hindi aligned sa Ambalu/Agui vision (franchise-ready + RPG UX)?
Anong mga paulit-ulit na bug/UX friction na kelangan ayusin once and for all?

2) Snapshot of Current State (pre-filled)
A. Payroll Lite – correctness & UX
Known issues:
Preview vs payslip mismatch (gross/deductions/net).
Deduction dating across months (e.g., 2025‑09‑30 posting into October views).
DTR Bulk Entry:
Tab order & keyboard-first input flow.
Save‑All performance (50–60s on large entries).
In2/Out2 optional columns ✅; copy‑down shortcut ✅.
New entries not included in computation (bug: Tue Day #7 case).
Next.js build error around toLocaleString (Turbopack parse): template string in new Date(${month}-01).
API /api/payslip/daily returned non‑JSON (502) during preview.
B. Design System & PDFs
Theme consistency (white + pastel green) missing in downloaded PDFs.
Cover page “wild payslip” + stray extra pages.
Floating circle artifact.
Spacing sa acknowledgment/signature lines.
Payroll computation layout: split Gross (left) vs Deductions (right), Net below.
C. Deployment Tooling
Vercel build: tsconfig/extends and path aliases; toast import path fixed by re‑export.
Reproducible builds for Next 15.x.
D. Agui World (RPG layer)
Adventure Log v1.0 approved; needs light linkage to real modules (skill tree → module maturity).
E. Ambalu (product pivot)
FO scent throw concerns post‑cure; considering gourmand over fruity tropical.
MP base vs CP; candle FOs vs soap safety & longevity.
F. Ops constraints
Chrome/DeepSeek lag on device; prefer lighter workflows while coding/deploying.

3) Decision Board (NOW / NEXT / LATER)
NOW (start today)
[ ] Fix payslip correctness (preview = payslip = truth).
[ ] DTR Bulk Entry → keyboard flow (Tab order + Enter=next-cell + copy‑down polish).
[ ] Deduction effective_date logic (month boundary correctness).
NEXT (after NOW is stable)
[ ] PDF export theme parity + spacing polish.
[ ] Save‑All performance budget (<5s target on typical month per employee).
[ ] /api/payslip/daily 502 root-cause & contract (always JSON).
LATER
[ ] RPG UI surface for module “level‑up” cues.
[ ] Ambalu scent roadmap & MP base R&D doc.

4) Concrete Tasks (DoD included)
T1 — Payslip correctness: preview == payslip
Steps:
[ ] Single source of truth for computation (extract to lib/payroll/compute.ts).
[ ] Unit tests for 3 cases: (a) no deductions, (b) with % late/absent, (c) with cross‑month deductions.
[ ] Wire both preview & PDF to same compute function.
DoD:
[ ] 3 unit tests green.
[ ] Manual check for Pedro & Juan sample employees shows identical totals.
T2 — DTR Bulk Entry keyboard-first flow
Steps:
[ ] Define column navigation order (Start→End→OT→… next day).
[ ] Enter moves down; Tab moves right; Shift+Tab left; Ctrl+D copy‑down.
[ ] Day/Week labels on right column per UX note.
DoD:
[ ] Encode one week without mouse.
[ ] No focus traps; copy‑down works cross-day.
T3 — Deduction effective_date logic
Steps:
[ ] DB rule: effective_date is the accrual date; aggregation groups by pay_month = DATE_TRUNC('month', effective_date).
[ ] UI filters use pay_month not created_at.
[ ] Migration/backfill for existing rows.
DoD:
[ ] 2025‑09‑30 sample shows in September, not October.
[ ] Edit/update works on Deductions page with immediate reflection.

5) Risks & Blockers
Data inconsistency between preview/payslip leads to trust issues.
Performance regressions if keyboard flow triggers uncontrolled re‑renders.
PDF renderer CSS isolation.

6) Parking Lot
DeepSeek local vs cloud strategy.
Ambalu gourmand pivot validation (sniff tests, longevity, supplier shortlist).
Franchise theming (tenant‑based design tokens).

7) Decisions Log
#
Decision
Date
Owner
Notes
1
Focus on Payroll correctness + DTR UX before new features
2025‑10‑07
Erwin
Stabilize before polish.
2
Top‑down, result‑first workflow is our default (visual → refine → full-file patch)
2025‑10‑07
Erwin
Speeds up shipping and feedback.


8) Action Items (owners & ETA)
[ ] Erwin: Paste realizations above (5–7 bullets).
[ ] GPT‑5: Propose specific code patches for T1/T2/T3 based on current repo structure.
[ ] Erwin: Pick Top 3 from Decision Board → confirm.

9) RESULT‑FIRST: Agui Core v0.1 (Dashboard + Global Settings)
Goal: Makita agad ang itsura ng “Open‑World RPG ERP” home screen with global design tokens and module toggles (no hard‑code). After this, we refine and wire deeper.
A) What you’ll see (today)
/agui — RPG‑style Home (cards = modules; theme uses CSS vars from DB).
/settings — Simple GUI to edit Theme (brand, primary, accent, radius) + Modules (enable/disable Payroll, CEODR, Employees, Inventory, POS). Saves to Supabase.
B) Supabase SQL (run this)
-- 1) Orgs table (tenant-ready, but single org is fine for now)
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  theme jsonb not null default '{}'::jsonb,
  modules jsonb not null default '{}'::jsonb,
  payroll jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2) Seed your org
insert into public.orgs (name, slug, theme, modules, payroll) values (
  'Vangie Variety Store',
  'vangie',
  '{"radius":"1rem","fontScale":1,"brand":"Agui","primary":"#06b6d4","accent":"#10b981","surface":"#f7fdfd","text":"#0b1220"}',
  '{"payroll": true, "inventory": false, "pos": false, "ceodr": true, "employees": true}',
  '{"att_mode":"DEDUCTION","default_rate_per_day":450}'
) on conflict (slug) do nothing;

-- 3) RLS (simple: allow public read, auth users can update)
alter table public.orgs enable row level security;
create policy "orgs_read" on public.orgs for select using (true);
create policy "orgs_update_auth" on public.orgs for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

C) Files to add (full replacements)
Paths assume your existing structure. If a file exists, replace it entirely.
1) src/lib/agui/types.ts
export type ModuleFlags = {
  payroll: boolean;
  inventory: boolean;
  pos: boolean;
  ceodr: boolean;
  employees: boolean;
};

export type ThemeTokens = {
  brand: string;
  primary: string; // hex
  accent: string;  // hex
  surface: string; // hex
  text: string;    // hex
  radius: string;  // e.g. '1rem'
  fontScale: number; // 0.9..1.2
};

export type Org = {
  id: string;
  name: string;
  slug: string;
  theme: ThemeTokens;
  modules: ModuleFlags;
  payroll: Record<string, unknown>;
};

2) src/lib/agui/defaults.ts
import type { ModuleFlags, ThemeTokens } from './types';

export const DEFAULT_THEME: ThemeTokens = {
  brand: 'Agui',
  primary: '#06b6d4',
  accent: '#10b981',
  surface: '#f7fdfd',
  text: '#0b1220',
  radius: '1rem',
  fontScale: 1,
};

export const DEFAULT_MODULES: ModuleFlags = {
  payroll: true,
  inventory: false,
  pos: false,
  ceodr: true,
  employees: true,
};

3) src/lib/theme.tsx
'use client';
import { useEffect } from 'react';
import type { ThemeTokens } from './agui/types';

function applyTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  const entries: Record<string, string | number> = {
    'brand': tokens.brand,
    'primary': tokens.primary,
    'accent': tokens.accent,
    'surface': tokens.surface,
    'text': tokens.text,
    'radius': tokens.radius,
    'font-scale': tokens.fontScale,
  };
  Object.entries(entries).forEach(([k, v]) => {
    root.style.setProperty(`--agui-${k}`, String(v));
  });
}

export function ThemeRoot({ tokens, children }: { tokens: ThemeTokens; children: React.ReactNode }) {
  useEffect(() => { applyTokens(tokens); }, [tokens]);
  return (
    <div className="min-h-screen bg-[var(--agui-surface)] text-[var(--agui-text)]">
      {children}
    </div>
  );
}

4) src/app/agui/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ThemeRoot } from '@/lib/theme';
import type { Org } from '@/lib/agui/types';
import { DEFAULT_THEME, DEFAULT_MODULES } from '@/lib/agui/defaults';

export default function AguiHome() {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('orgs')
        .select('*')
        .eq('slug', 'vangie')
        .maybeSingle();
      if (!mounted) return;
      if (error) console.error(error);
      setOrg(
        data ? (data as unknown as Org) : {
          id: 'local', name: 'Vangie Variety Store', slug: 'vangie',
          theme: DEFAULT_THEME, modules: DEFAULT_MODULES, payroll: {}
        }
      );
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  if (loading || !org) return <div className="p-6">Loading Agui…</div>;

  const { theme, modules } = org;
  const cards: Array<{ key: keyof typeof modules; title: string; desc: string; href: string }>= [
    { key: 'payroll', title: 'Payroll Lite', desc: 'Compute, Payslips, DTR', href: '/payroll' },
    { key: 'ceodr', title: 'CEODR', desc: 'Daily cash reports', href: '/ceodr' },
    { key: 'employees', title: 'Team Members', desc: 'Profiles & roles', href: '/employees' },
    { key: 'inventory', title: 'Inventory', desc: 'Stock & movement', href: '/inventory' },
    { key: 'pos', title: 'POS', desc: 'Sell & receipts', href: '/pos' },
  ];

  return (
    <ThemeRoot tokens={theme}>
      <div className="p-6 max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold" style={{ letterSpacing: '0.02em' }}>
            {org.name} · <span style={{ color: 'var(--agui-primary)' }}>Agui</span>
          </h1>
          <p className="text-sm opacity-80">Open‑World RPG ERP · choose a module to level‑up</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <a
              key={c.key}
              href={c.href}
              className={`rounded-2xl p-4 border shadow-sm transition transform hover:-translate-y-0.5 ${
                modules[c.key] ? 'opacity-100' : 'opacity-40 pointer-events-none'
              }`}
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            >
              <div className="text-lg font-semibold">{c.title}</div>
              <div className="text-xs opacity-70">{c.desc}</div>
              <div className="mt-3 text-xs">
                {modules[c.key] ? 'Enabled' : 'Disabled in Settings'}
              </div>
            </a>
          ))}
        </section>

        <footer className="mt-8 text-xs opacity-60">
          Theme · brand: <b>{theme.brand}</b> · primary: <code>{theme.primary}</code> · accent: <code>{theme.accent}</code> · radius: <code>{theme.radius}</code>
          <span className="ml-2">→ <a className="underline" href="/settings">Edit in Settings</a></span>
        </footer>
      </div>
    </ThemeRoot>
  );
}

5) src/app/settings/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Org, ThemeTokens, ModuleFlags } from '@/lib/agui/types';
import { DEFAULT_THEME, DEFAULT_MODULES } from '@/lib/agui/defaults';

export default function SettingsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [theme, setTheme] = useState<ThemeTokens>(DEFAULT_THEME);
  const [mods, setMods] = useState<ModuleFlags>(DEFAULT_MODULES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orgs').select('*').eq('slug', 'vangie').maybeSingle();
      if (data) {
        const o = data as unknown as Org;
        setOrg(o);
        setTheme({ ...DEFAULT_THEME, ...o.theme });
        setMods({ ...DEFAULT_MODULES, ...o.modules });
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('orgs')
      .update({ theme, modules: mods })
      .eq('slug', 'vangie');
    setSaving(false);
    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      alert('Saved! Refresh /agui to see changes.');
    }
  }

  function colorInput(label: keyof ThemeTokens) {
    const isColor = ['primary','accent','surface','text'].includes(label);
    return (
      <label className="flex items-center gap-3 text-sm">
        <span className="w-24 capitalize">{label}</span>
        {isColor ? (
          <input type="color" value={(theme as any)[label] as string}
            onChange={(e) => setTheme({ ...theme, [label]: e.target.value } as ThemeTokens)} />
        ) : label === 'radius' ? (
          <input type="text" className="input input-bordered"
            value={theme.radius}
            onChange={(e) => setTheme({ ...theme, radius: e.target.value })} />
        ) : label === 'brand' ? (
          <input type="text" className="input input-bordered"
            value={theme.brand}
            onChange={(e) => setTheme({ ...theme, brand: e.target.value })} />
        ) : (
          <input type="number" step={0.05} min={0.8} max={1.4}
            value={theme.fontScale}
            onChange={(e) => setTheme({ ...theme, fontScale: parseFloat(e.target.value) })} />
        )}
      </label>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm opacity-70 mb-6">Global design + module toggles (no hard‑code).</p>

      <section className="mb-8 space-y-3">
        <h2 className="font-semibold">Theme</h2>
        <div className="grid gap-3">
          {(['brand','primary','accent','surface','text','radius','fontScale'] as Array<keyof ThemeTokens>).map(colorInput)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-semibold">Modules</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(Object.keys(DEFAULT_MODULES) as Array<keyof ModuleFlags>).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={mods[k]} onChange={(e) => setMods({ ...mods, [k]: e.target.checked })} />
              <span className="capitalize">{k}</span>
            </label>
          ))}
        </div>
      </section>

      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl border">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

D) How we’ll iterate (top‑down rhythm)
Result first: You tune colors/toggles in /settings, see the impact in /agui.
Refine: You list tweaks (copy, layout, UX), I ship full‑file replacements.
Deepen: We wire actual module routes and guard disabled modules.
E) Definition of Done for Agui Core v0.1
/agui renders and reflects DB theme + toggles.
/settings updates the same row in Supabase.
No hard‑coded module enablement or colors in UI.

Ready when you are. Next message: tell me once you’ve run the SQL so we can drop in the files above and open /agui.

RPG Taxonomy v2 — Alliance → Guild → House (Company) (Draft)
A) Hierarchy & Terms
Guild Alliance — umbrella for many Guilds (franchise networks, regional coalitions).
Roles: alliance_lord (platform admin), alliance_steward (mods), alliance_member (guilds admitted).
Guild — typed org: MERCHANT, ADVENTURER, APOTHECARY (extensible).
Roles: guild_master (CEO/owner), guild_elder (manager), staff, supplier, customer, franchisee, org_admin, agui_user.
House (Company) — a business owned by a member of a Merchant Guild. Examples: Retail store, Manufacturer, Brand.
Roles: house_owner, house_manager, house_staff.
A Merchant Guild member can create multiple Houses (e.g., Vangie Variety Store as Retail; Ambalu as Brand/Manufacturer).
Party — subgroup inside a Guild or House (Departments, Branches, Squads; or Barkada in Adventurer guilds).
Roles in Party: captain, member.
Canonical model terms for DB/admin: Alliance → Guild → House → Party.
 Public labels: can render as Alliance / Guild / Company / Team (configurable per tenant).

B) Loyalty (names & scope)
Alliance‑level (optional): Alliance Pass — spans many Guilds (coalition promo).
Guild‑level (Merchant): Guild Card — customer perks across that Guild’s Houses.
House‑level (Company): choose one:
Patron Pass (clean, friendly)
House Crest (RPG vibe)
Trade Sigil (stylized)
ShopPass (modern, simple)
Suggestion: default naming — Alliance Pass (alliance), Guild Card (guild), Patron Pass (house). All are customizable in /settings → UI Terms.

C) Types (extensible)
guild_types: MERCHANT, ADVENTURER, APOTHECARY, … (users can add types)
house_types under Merchant Guilds: RETAIL, MANUFACTURER, BRAND, SERVICE, WHOLESALE, DISTRIBUTOR (extensible)

D) Creation Flows
1) Player (Character Creation)
Sign up (phone/email) → lookup by identifier → create Entity (PERSON) if new → role agui_user.
2) Join Merchant Guild (Membership)
Player applies to Merchant Guild → guild_member if accepted (auto or with approval by guild_elder/guild_master).
3) Create House (Company) — only for Merchant Guild members
Choose House Type (Retail/Manufacturer/Brand/…).
Fill company basics (name, slug, address, tax flags).
Creator becomes house_owner.
Optional: seed Parties (Branches/Departments).
Turn on Patron Pass (house loyalty).
Adopt items via barcode scan into this House’s catalog.
4) Loyalty Enrollment
Guild Card: customers enroll at guild level → points usable across Houses in that Guild.
Patron Pass: enroll per House (Company) for house‑specific perks.

E) Data Model (lean version)
Identity: entities, entity_identifiers (phone/email unique), one identity across all scopes.
Alliance: alliances, alliance_guilds (join table), alliance_roles (entity ↔ alliance).
Guild: guilds (guild_type), guild_roles (entity ↔ guild), parties + party_members.
House: houses (house_type, guild_id), house_roles (entity ↔ house), house_parties + house_party_members (or reuse parties with scope='HOUSE').
Loyalty: loyalty_schemes (scope: ALLIANCE/GUILD/HOUSE), loyalty_profiles (scheme_id, entity_id, points, tier, account_no).
Inventory: global items, item_barcodes; per‑house house_items (price/sku/stock).
We’ll migrate gradually from current orgs → guilds. For now, your orgs row = one Merchant Guild.

F) Example — Vangie in this world
Alliance: Kalinga Retail Alliance (optional).
Merchant Guild: Vangie Guild (type MERCHANT).
Houses:
Vangie Variety Store (RETAIL) — uses Patron Pass.
Ambalu (BRAND/MANUFACTURER) — can run its own Patron Pass; can also tie into Vangie Guild Card.
Adventurer Guild: Vangie Community (loyalty fan club) — hosts barkada Parties.

G) First UI surfaces to ship
/alliances & /alliances/[slug] (optional)
/guilds & /guild/[slug] (cards: Players, Companies, Parties, Loyalty, Inventory)
/guild/[slug]/join (become member)
/guild/[slug]/companies/new (create Company)
/guild/[slug]/guild-card (enroll Guild Card)
/company/[slug]/patron-pass (enroll Patron Pass)
/company/[slug]/inventory/scan (barcode → adopt item)

H) Pass System v1 — One Credential, Many Skins (with Incognito)
1) Precedence & Scope
Schemes (highest → lowest): GLOBAL (Member Pass) > GUILD (Guild Card) > COMPANY (Patron Pass).
A person can hold multiple cards, all tied to the same Entity.
Permissions come from roles at the scope of the card being used + above (least-privilege views by default).
2) Enrollment Rules
When enrolling a lower-precedence card, system checks for any higher-precedence active card on that Entity.
Staff prompt: “Higher-level card found (Member Pass/Guild Card). Continue issuing this lower card?”
Buttons: Use higher card / Issue lower card anyway (requires reason, logged).
Reason examples: “prefers low-profile card”, “dedicated to this company”, “lost primary card (temporary)”.
3) Incognito Mode (per card)
Card flag: incognito_default: boolean (card level) and per-scan override.
If incognito:
UI hides cross-scope info (don’t reveal that user holds higher cards or admin roles).
Only show scope-limited profile (e.g., Company-only points, local name on file).
Staff with privilege can lift incognito for the session (with reason) for fraud checks.
4) Scan Resolution Flow
token → cards → card_schemes → entity → (roles at scope) → (benefit_accounts at scheme) → UI HUD
HUD shows Scope (Global/Guild/Company), Incognito badge if active, and minimal info.
Access control reads roles at that scope; higher roles are not displayed if incognito.
5) Data Model (minimal)
card_schemes (id, scope: GLOBAL/GUILD/COMPANY, name, precedence, design jsonb, allow_incognito boolean, is_active)
cards (id, scheme_id, entity_id, card_no unique, status, issued_at, flags jsonb → {incognito_default:true})
card_tokens (id, card_id, kind: qr/barcode/nfc, token_hash, active, expires_at)
benefit_accounts (scheme_id, entity_id, points, tier, balance, meta)
scan_events (id, token_id, resolved_card_id, company_id/guild_id, actor_id, lifted_incognito boolean, reason text, created_at)
6) Owner/Admin “Crest”
Optional admin skin: same Entity; card in GLOBAL or GUILD scope with role_badges=['guild_master','guild_elder'] displayed only when not incognito.
7) UX Surfaces (first cut)
/passes/member — show your Member Pass (download QR, rotate token).
/guild/[slug]/guild-card — enroll/search by phone/email + issue Guild Card.
/company/[slug]/patron-pass — enroll/search + issue Company Pass.
/company/[slug]/clock — scan to clock in/out (Company scope; incognito respected).
Staff prompts and override dialogs wired to scan_events reasons.
8) Order of Work (Foundations first)
Entities & Identifiers (single identity).
Card Schemes & Cards (with precedence + tokens).
Roles & Permissions (Alliance/Guild/Company scopes).
Benefit Accounts (points/tiers per scheme).
Scan Events (attendance/redemption).
UI Shells (passes + enroll + scan HUD).

I) Next
Say go when ready; I’ll drop SQL + full-page shells for the Pass System v1 so you can see it immediately.

POS Edge Rules & Suspend/Resume (v1)
1) Cart & Pricing Edge Rules (to avoid surprises)
Tiering is cart-wide per item (sum of base units across all UOM lines). Hitting a higher tier re-prices all lines of that item live.
Repricing is deterministic: tiers first (by highest min_base_qty ≤ total), else explicit UOM price, else base unit × multiplier.
Bundles/kits: if multi-SKU, expand to components for stock deduction; if same-SKU packs, just multiplier.
No double scans: ignore identical scan within 300ms window (same device, same context).
Qty prefix timeout: 6* buffer expires after 2s if no scan.
Rounding: compute in centavos (integers); display rounded.
Negative stock: configurable; if disallowed, show blocker w/ manager override + reason.
Line discounts: role-gated; discount + tax/rounding order is consistent (documented per tenant).
Receipt totals: recomputed from line models (never trust UI values), idempotent finalize.
2) Suspend / Resume (Hold a sale)
Goals: blazing fast, crash-safe, and cross-device like Loyverse.
Data model
sales (id, company_id, device_id, status: OPEN|HELD|COMPLETED|VOID, grand_total, seq_no, version, created_at, updated_at)
sale_lines (sale_id, line_no, item_id, uom, multiplier, qty, unit_price, line_total, meta)
sale_payments (sale_id, method, amount, meta)
sale_holds (sale_id, reason, hold_by_entity_id, hold_device_id, hold_token, expires_at nullable)
Indices: (company_id, status, updated_at desc), (device_id, status)
Behavior
Hold (Suspend): F9 → prompt reason; set status=HELD, write sale_holds with hold_token (short code/QR), bump version.
Resume (same device): list recent HELD; pick and resume; optimistic lock via version.
Resume (cross-device): any register in same company can search or scan the hold QR; requires that the held sale is synced.
Lock/Lease: when a device resumes a held sale, it places a short lease (e.g., 60s auto-renew) to avoid concurrent edits. If lease expires, another device may take over.
Offline semantics:
If origin device is offline when you hold, sale is HELD_LOCAL until it syncs. Other devices won’t see it yet.
UI badge shows Held (Local) vs Held (Synced).
Cross-device resume requires sync (both devices online or origin synced later).
Crash safety
Cart is snapshotted to local DB every change (append-only). On crash/reload, OPEN sale auto-restores. Holding also snapshots a compact copy.
3) Finalize & Receipt Prompt
After successful finalize:
Prompt: “Print receipt?” [Y] Yes / [N] No (keyboard: Y/N, default per device setting, optional 5s auto-default).
Device setting: auto_print: on/off/ask.
Reprint last: shortcut (e.g., Ctrl+P) while on success screen.
4) Keyboard & UX
Keymap is editable per company and overridable per device.
Defaults: QTY_PREFIX=*, DUPLICATE_LAST=Insert, WHOLESALE_TOGGLE=F11, HOLD_RESUME=F9, FINALIZE=F12, PRINT_Y=Y, PRINT_N=N.
Scan HUD always shows: Item, UOM, Units, Price, COST; if tier hits, shows a small toast “Tier 8+ @ 11.50 applied”.
5) Sync & Idempotency
All writes have client ids + monotonic local seq (idempotent server upserts).
finalize endpoint uses an idempotency key (company_id, device_id, local_seq) to avoid duplicates.
Conflicts resolved by version (optimistic concurrency). On conflict: UI offers Reload or Force take-over (requires role + reason).
6) EOD & Audit
Z-summary locally computed then reconciled with server after sync (cash in drawer, expected, variance).
Audit sensitive actions: hold/resume, force take-over, price override, negative-stock override, print re-issue.
7) Printing
Start with browser print template; later optional ESC/POS via WebUSB.
Each register can store its paper width & margins.
8) Performance Budget
Cold start (after SW warm) < 2s; barcode → line add < 30ms; reprice 100 lines < 10ms.

Next: When you say go, I’ll add the concrete SQL (tables above), the POS local DB schema (SQLite), and a React shell with the exact key bindings + Hold/Resume list and the Y/N receipt prompt.

Identity Intelligence & Security (v1) — Customer 360, Fraud Guard, & Case Handling
A) Objectives
Customer 360: one screen to verify identity, purchase history, points, last visit, preferred items, devices used, and memberships (passes).
Fraud Guard: signals for risky behavior (returns abuse, promo abuse, duplicate accounts, buddy punching).
Case Handling: quick creation of a complaint/ticket with receipt lookup + attachments.
Privacy & Compliance: PH Data Privacy Act alignment; role-gated access & audit.
B) Data we keep (minimal, useful)
Identity & Passes: entity, identifiers (phone/email), cards & tokens.
Sales Ledger: sales, sale_lines, payments (already needed by POS).
Benefits Ledger: benefit_accounts, benefit_txns (earn/burn, reasons).
Attendance (optional): attendance_events for staff.
Devices & Sessions: device_id, last active, failed scans.
Cases: cases (complaints/requests), case_events (updates), attachments (photos/receipts).
C) Derived metrics (computed nightly or on-demand)
Last Purchase: date/time, company, branch; link to receipt.
Preferred Items: top-N items by frequency/spend; brand affinity.
Avg Basket Size; Visit Frequency; LTV.
Return Ratio & Refund Flags; Promo Abuse Flags (stacking beyond policy).
Trust Score (0–100): weighted mix of tenure, verified identifiers, steady behavior, low disputes, normal redemption rate.
Risk Notes: failed payment attempts, suspicious multi-accounts (same phone/email/device).
D) Gas Cylinder Example (verification toolkit)
Serialized items: enable per-item serial capture (e.g., tank ID) at sale/return.
Proof of purchase: search by phone, card, serial, or date range → show receipt.
Consumption check: rules engine: expected range for cylinder capacity; flag anomalies (e.g., 1-week consumption) for manual review.
Warranty/Deposit: handle returnable containers & deposits.
E) Case Handling Flow
Create Case tied to Entity (+ optional serial no.).
Attach receipt (auto-linked if looked up) + photos.
Classify (product issue, service issue, payment issue).
Resolve with outcome (refund, replacement, education), and mark signals neutralized.
F) Security & Privacy Controls
Role-gated: only guild_elder+ may view full Customer 360; cashiers get masked view.
Incognito Respect: if card is incognito, show minimal scope-only data unless elevated with reason.
Audit: viewing PII, lifting incognito, role changes, manual points, attendance edits, price overrides.
Retention: sales 5 years (configurable); PII minimization & right-to-access/export/delete.
G) UI Surfaces
/entity/[id]/profile — Customer 360 (history, passes, trust score, last purchase, favorites).
/cases/new — quick case wizard with receipt lookup.
Inline lookup from POS: F8 Price/History Check → shows last purchases & warranties.

Priority Plan — What we build next (result‑first)
NOW (Start)
Foundations SQL Pack
entities, entity_identifiers (normalized + unique), basic RLS.
card_schemes, cards, card_tokens (precedence + incognito flag).
Indexes & audit skeletons.
POS Shell (Offline Guest)
Local SQLite schema (sales, sale_lines, holds, payments, inventory_txns).
Cart engine (qty prefix, auto-increment, Insert duplicate, F11 wholesale chooser, tier pricing), Hold/Resume, Y/N print prompt.
Keymap config per company/device.
NEXT
Customer 360 (read-only)
/entity/[id]/profile shows last purchase, favorites, points, trust signals.
/cases/new minimal case logging + receipt attach.
Pass Integrations
Use Member Pass to log in/clock in; respect incognito; scan HUD.
LATER
Fraud Guard v1 (rules & thresholds) + Nightly Metrics jobs.
Serialized Items & container deposit flows.
Action: When you say go, I’ll paste the full Foundations SQL Pack + POS Shell files so you can see & test immediately, then we’ll add Customer 360 next.

Marketing & Notifications v1 — Segments, Campaigns, and Smart Alerts
A) Goals
Mass messaging, personalized (e.g., “Hello Angel!”) with opt‑in/opt‑out per channel.
Behavioral alerts (restock/new listing for favorites like kakanin).
Scoped marketing (Company/Guild/Alliance) with strict privacy & consent.
B) Channels
SMS (primary), Email, PWA Push (fallback to SMS), future: Viber/WhatsApp.
Quiet hours (e.g., 9pm–7am, configurable), frequency caps, per‑user language (Tagalog/English).
C) Consent & Privacy (critical)
Per entity consent table with channel flags + scopes (Company/Guild/Alliance).
Double opt‑in for SMS; STOP/HELP keywords; per‑tenant sender ID.
Suppression lists (unsubscribed, bounced, DND).
Audit: who sent, which segment, proof of consent; retention policy aligned with PH Data Privacy Act.
D) Data Model (lean)
channel_configs (per company/guild: sender id, limits, quiet hours)
consents (entity_id, scope_type, scope_id, sms_opt_in, email_opt_in, push_opt_in, lang, updated_at)
segments (id, owner_scope, name, filter_json)
campaigns (id, scope, name, template_id, schedule_at, status, ab_test json)
message_templates (id, channel, body, variables json, lang)
campaign_targets (campaign_id, entity_id, state: QUEUED|SENT|FAILED|SUPPRESSED, reason)
message_jobs (idempotent batch id, provider_job_id, retries, cost_est)
delivery_receipts (provider_msg_id, status, delivered_at, error)
event_subscriptions (scope, event: RESTOCK|NEW_LISTING|PRICE_DROP, filter_json)
event_notifications (subscription_id, entity_id, payload, sent_at)
E) Personalization
Template variables: {{alias}}, {{item_name}}, {{price}}, {{branch}}, {{link}}.
Alias priority: preferred name → first name → “Kaibigan”.
Language switch per entity (lang).
F) Segments (examples)
Kakanin Lovers: bought ≥2 times in last 60 days in category kakanin OR affinity score ≥ 0.6.
Near Lapsing: last purchase >30 days, LTV top 30%.
New Members: joined in the last 7 days.
High Return Rate: return ratio > threshold → exclude from promo segments.
G) Smart Alerts
Restock alert: subscribe on product card; sends when inventory_txn raises stock above threshold.
New Listing: subscribe by category/brand; notify first 1–2 times only.
Price Drop: if current price < historical average by X%.
H) Rules to prevent spam/abuse
Frequency cap (per entity): e.g., ≤ 2 SMS/day, ≤ 6/week.
Dedup per window: same message to same person within 72h suppressed.
Quiet hours enforced; overrides require elder+ with reason.
Scope-respect: Company campaigns only to their consents; Alliance needs explicit cross‑scope opt‑in.
I) UX Surfaces
Campaign Builder /marketing/campaigns/new
Pick scope (Company/Guild/Alliance)
Choose segment (query builder)
Pick template & preview (per-language)
Schedule, frequency cap, quiet hours
Cost estimate & recipients count
Test send to seed list
Segments /marketing/segments (saved filters).
Alerts /marketing/alerts (subscribe/manage restock/new listing).
Reports /marketing/reports (delivered, CTR with short links, redemptions, revenue lift, unsub rate).
J) Example Templates
Promo SMS:
 "Hi {{alias}}! May bagong kakanin today sa {{branch}} — {{item_name}} @ {{price}}. Limited stocks! {{link}}"
Restock SMS:
 "{{alias}}, restocked na ang {{item_name}}. Punta na sa {{branch}}! {{link}}"
K) Dispatch Engine
Batches by provider limits; idempotent jobs; retries with backoff; per-minute throttle.
Short-link service with per-campaign UTM for CTR & conversion tracking (POS coupon code or tap-to-redeem link).

Status: Planned. After Foundations + POS Shell, this is a strong NEXT candidate to demo (simple segment + one SMS template + delivery receipts).

Hybrid Companies & Composable POS v1 (Cafe/Pharmacy/Meat/Convenience)
A) Company Types → Capabilities (hybrid-ready)
Company can enable multiple Capabilities: CONVENIENCE, CAFE, MILKTEA, PHARMACY, MEAT, BAKERY, etc.
Store as tags: company_capabilities(company_id, capability_code) → drives UI (menus, modifiers) and compliance (e.g., Pharmacy = lot/expiry, controlled sales).
B) Product Model (works for both retail + ingredient-based)
Items (stocked things): raw ingredients (sugar, pearls), semi-finished (brewed tea), and retail goods (Bear Brand).
Menu Products (sellable entries): drinks, meals, combos—may consume ingredients via Recipe BOM.
Packs & Bundles:
Packs (same SKU, different UOM): via item_uoms & item_barcodes (already planned).
Bundles/Combos (multi-SKU): item_kits linking components with qty.
Modifiers (add-ons/options):
Modifier Groups: e.g., Sugar Level, Size, Sinkers, Shots.
Each Modifier may: (a) add price, (b) consume ingredients (e.g., +1 espresso shot), (c) force choices (exactly one or up to N), (d) be optional.
C) Data (lean schema additions)
menu_products (id, company_id, name, base_price, category_id, active, meta)
menu_variants (menu_product_id, code: SMALL|MED|LARGE, price_delta, meta)
recipes (menu_variant_id, ingredient_item_id, qty, uom)
 → quantities per variant; supports yield via semi-finished items.
modifier_groups (company_id, name, min_select, max_select, applies_to: category or product)
modifiers (group_id, name, price_delta, meta)
modifier_effects (modifier_id, ingredient_item_id, qty, uom)
 → inventory consumption when chosen.
production_batches (company_id, output_item_id, planned_qty, actual_qty, uom, started_at, closed_at, waste_qty)
 → converts raw → semi-finished (e.g., brew tea, cook pearls) with yield & waste.
scale_plu (company_id, plu_code, item_id, price_per_kg, label_name, barcode_pattern)
 → supports embedded weight/price barcodes and deli labels.
Inventory ledger remains base units; recipes & modifiers translate sales into ingredient consumption.
D) POS Behavior (cafe/meat specifics)
Cafe/Milktea
Choose Variant (size) then Modifier Groups in a guided panel.
Modifiers adjust price & inventory (e.g., extra shot = +₱X + 30ml espresso bean equivalent).
Sugar Level can drive a small syrup quantity delta without price.
Meat / Per‑weight
Integrate scales: read weight from HID/Serial; or parse price‑embedded barcode (EAN‑13 prefixes 20–29).
Manual input allowed: type weight (e.g., 0.928*) then scan item → line uses price/kg × weight.
“Nice price” negotiation: action Set Line Total → computes implied discount and records NEGOTIATED reason (role‑gated, with threshold).
Always store the original weight, price/kg, discount amount, and final total in the line model for audit.
E) Edge Rules (added to POS Edge Rules section)
Recipe consumption: on finalize, create inventory ledger rows for all ingredients from recipe + modifiers + kits.
Prepped components: require open production batch; if insufficient, allow negative (configurable) with supervisor override.
Weight rounding: round weight to device precision (e.g., 0.005 kg); pricing in centavos; display nicely.
Price‑embedded barcodes: support both embedded weight and embedded price formats; verify checksum; fallback to manual.
Pharmacy (if enabled): lots/expiry, max qty per sale, age/advice prompts, cashier acknowledge checkbox (stored in audit).
F) Keyboard/Speed
Variant shortcuts (e.g., 1=Small, 2=Med, 3=Large).
Sugar hotkeys (e.g., Alt+1=0%, Alt+2=25%, … configurable).
Add‑on quick keys (e.g., S=Sinkers, E=Espresso).
Set Line Total (e.g., Ctrl+=) for negotiated price; requires PIN if over % threshold.
G) Costing & Menu Engineering
Standard cost from recipe at current avg ingredient costs; show margin in PLU manager.
Waste logged from production batches; variance shown daily.
H) Roadmap placement
These extend the POS Shell work. We can ship a minimal cafe flow (variants + one modifier group + recipe consumption) right after POS Shell, then add scales and embedded barcodes next.
Impact: This covers hybrid stores (convenience + milktea + cafe + meat + pharmacy), keeps performance, and preserves clean accounting of costs and stock.

Decision Support — Forecasting, Replenishment & Supplier Optimization (v1)
A) Goals
Never‑stockout, never‑overstock: right qty at the right time per branch.
Hands‑off suggestions: daily auto‑plan of POs & production, with clear explanations.
Supplier smart picks: cheapest landed cost, schedules, MOQs, and reliability.
B) Data we use
Sales history (by company/branch, item/uom, date/time).
Inventory ledger (current on‑hand, on‑order, reserved, expiry if perishable).
Lead times (per supplier→item), delivery days/slots, MOQs, price breaks.
Recipes (to convert menu demand → ingredient demand).
Calendar (day‑of‑week effect, holidays, events), promo flags.
C) Forecast methods (simple, robust)
Default: 7/14‑day moving average with day‑of‑week multipliers.
Intermittent demand: Croston‑style smoothing (approx) or last‑N nonzero avg.
Cold start: category average × scaling; manual minimums allowed.
D) Safety stock & reorder point
Service level target (e.g., 95%).
Demand during lead time: DL = mu * L.
Safety stock: SS = z * sigma * sqrt(L) where z=1.65 for 95% and sigma = RMSE of recent forecast error.
Reorder point: ROP = DL + SS.
Order‑up‑to level (days of cover): OUT = mu * days + SS.
E) Order quantity
If (on_hand + on_order) < ROP → suggest Q = max(0, OUT − (on_hand + on_order)).
Respect MOQ, case pack, and price‑break ladders; round up to nearest pack.
F) Supplier selection
Supplier catalogs: price, currency, breaks (1–49, 50–99, ≥100), MOQ, lead time, delivery schedule.
Landed cost = base price − discounts + freight share + taxes.
Pick the cheapest landed that meets MOQ & schedule; tie‑break by best on‑time%.
Option: split allocation (e.g., 70% A, 30% B) to hit breaks or hedge risk.
G) Daily Auto‑Plan (cron @ 02:00)
Compute mu, sigma, DOW multipliers; update item stats.
For each branch item: check ROP, compute Q.
Roll up by supplier (respect next delivery slot).
Build PO drafts with explanations (why qty, which break, ETA).
Flag conflicts (budget, storage cap, expiry risk).
Notify elder/master to review & approve.
H) Production planning (Cafe/Milktea)
Convert menu forecasts → ingredient requirements via recipe.
Suggest production batches (brew tea, cook pearls) with yields & waste.
Generate ingredient POs if below ROP.
I) UI surfaces
Replenishment Dashboard (by branch): Low‑in‑3‑days, Stockout risk today, Overstock, Expiry in X days.
Purchase Plan: PO drafts grouped by supplier; sliders for days of cover & service level; instant recompute.
Supplier Compare: landed cost, lead time, on‑time%, last price, break ladders; split allocation UI.
Why this qty? explainer: shows mu, sigma, L, ROP, OUT, breaks, packs, and adjustments.
Production Plan (cafe): today’s brew/cook schedule & quantities.
J) Edge rules & guardrails
Zero‑stock days don’t zero your forecast (gap‑fill).
Promo spikes are down‑weighted after promo window.
Substitutes: if core SKU OOS, suggest sibling/size pack; mark as substitution.
Perishables: FEFO; limit order by shelf life; warn on storage capacity.
Returns/voids excluded from demand baseline.
Manual overrides require reason; all decisions audited.
Budget cap per supplier; suggest deferrals if exceeded.
K) Example — Bear Brand Swak (branch Purok 3)
Last 14 days avg mu = 9.5 pcs/day; RMSE sigma = 3.0.
Lead time L = 3 days; target cover = 14 days.
DL = 28.5, SS ≈ 1.65 * 3.0 * sqrt(3) ≈ 8.6 → ROP ≈ 37.
On‑hand 22, On‑order 6 → 28 < 37 (below ROP).
OUT = 9.5 * 14 + 8.6 ≈ 141.6 → target 142 base units.
Suggest Q = 142 − 28 = 114 pcs → round to case pack 60 → 120 pcs.
Supplier compare: A @ ₱11.70 (break ≥100), B @ ₱11.60 (break ≥200, ETA 6d). → Choose Supplier A (faster), or split 120:A(60) + B(60) if budget allows.
L) Minimal schema adds
item_stats (company_id, branch_id, item_id, mu, sigma, dow_factors jsonb, updated_at)
supplier_catalogs (supplier_id, item_id, price, currency, break_json, moq, pack, lead_time_days, schedule_json)
po_drafts / po_lines (status: DRAFT|APPROVED|SENT|RECEIVED; reason_json)
production_plans / production_lines
M) Algorithm (pseudo)
mu = moving_average(sales[-14d], by_dow=true)
sigma = rmse(actual - forecast)
if (on_hand + on_order) < (mu*L + z*sigma*sqrt(L)):
  OUT = mu*cover_days + z*sigma*sqrt(L)
  Q = ceil_to_pack(max(0, OUT - (on_hand + on_order)))
  supplier = argmin(landed_cost_with_breaks(Q), lead_time_ok)

N) Roadmap
v1 (this plan): MA + DOW factors, safety stock, PO drafts, supplier compare, production plan.
v2: ETS/Prophet seasonality, event overrides, margin optimizer, automated send with budget guard.

Payments & Settlement v1 — Multi‑Channel + Cash Flow Advisor (Agui)
A) Payment Channels (configurable per Company)
Modes: CASH, GCash, Maya, PalawanPay, BankTransfer, Cheque (PDC supported), Others (extensible).
Toggle on/off per company (and per device if needed).
Split payments supported (e.g., ₱400 cash + ₱100 GCash).
Offline‑safe: payment intents cached; sync + reconcile when online.
Tables (lean):
company_payment_modes(company_id, mode, enabled, details_json)
payments(sale_id, mode, amount, ref_no, ref_date, meta)
B) Cheque Handling (PDC)
cheques(id, company_id, payee, bank, check_no, amount, due_date, status: ISSUED|CLEARED|BOUNCED|CANCELLED, memo)
Link cheques to Payouts (supplier/expense) or Receipts (customer AR).
Nightly job: roll status by due_date + manual bank reconciliation.
C) Cash Flow Forecast & Advisories
Inputs: daily sales (by mode), vault counts, bank deposits, supplier bills/POs, payroll, taxes, PDCs.
Projection: rolling 7‑day cash position per bank + vault.
Alerts:
Low balance (next 3‑day obligations > projected balance).
Upcoming cheque clearances (T‑1).
Deposit recommendation (vault overflow or deficit risk).
Advisor persona (Agui): friendly mode or serious mode; messages with clear numbers + reasons.
Tables:
bank_accounts(id, company_id, bank_name, acct_no, balance_cache, updated_at)
bank_transactions(id, bank_account_id, amount, kind: DEPOSIT|WITHDRAWAL|FEE|INTEREST, ref, posted_at)
cash_projection(company_id, bank_account_id, date, projected_balance, reason_json)
deposit_vouchers(id, company_id, vault_amount, bank_account_id, scheduled_date, status)
D) Daily Owner/Elder Digest (example)
Agui: “Sales today ₱18,500. Vault ₱32,000. Tomorrow clearing cheques ₱12,000; Monday supplier due ₱30,000.
 Projected bank balance on Monday ₱22,000 → short by ₱8,000.
 Suggest: deposit ₱20,000 tomorrow to keep 5‑day buffer. Prepare voucher?”
E) End‑of‑Day & Reconciliation
EOD report per register + company summary: by payment mode, variances, deposits made.
Reconcile bank deposits vs recorded payments (flags mismatches).
Export: CSV/PDF + audit trail.
F) POS UX hooks
Payment screen shows only enabled modes; remembers last used.
Split dialog with quick keys; amount validation; change due computed from cash portion only.
After finalize: Print receipt? Y/N prompt (default per device).
Suspended sales survive crashes; resume cross‑device when synced.
G) Edge Rules
Idempotent finalize (idempotency key); prevent double charge.
Cheque: cannot backdate clear; clearing creates bank_transaction entry.
Timezone strict: store UTC; render Asia/Manila.
Permissions: cash drawer open, price override, cheque edit → elder+ with reason; all audited.
H) Phase 2 Integrations
Optional APIs: GCash/Maya transaction pulls, bank statement import (CSV/API).
Auto‑match deposits ↔ payments; confidence score; exception queue.

Status: Added to roadmap. Slotting under NOW (POS Shell) → payments core + split; NEXT → Advisor digest & projection; LATER → provider/bank integrations.

Guild Mascots v1 — Per‑Guild Persona, Templates, and Triggers
A) Why (goals)
Brand personality per Guild (and optional per Company), not one-size-fits-all.
Higher engagement on alerts/advice (finance, inventory, marketing).
Clarity: mascot speaks with the Guild’s tone; serious mode for compliance.
B) Levels & scope
Alliance Mascot (optional) — umbrella announcements.
Guild Mascot (default) — primary persona users see.
Company Mascot (optional override) — for store-specific voice.
C) Data model (lean)
mascots(id, scope_type: ALLIANCE|GUILD|COMPANY, scope_id, name, tone: FRIENDLY|SERIOUS|PLAYFUL, lang_prefs: ['fil','en'], avatar_url, color, enabled, meta)
mascot_templates(id, scope_type, scope_id, code, channel: INAPP|SMS|EMAIL|PUSH, lang, body_template, variables json, ab_group, severity)
mascot_triggers(id, template_id, rule_json, schedule_cron, active)
mascot_messages(id, template_id, entity_id nullable, payload_json, channel, sent_at, delivery_status)
mascot_feedback(id, message_id, rating, comment)
Variables (examples): {{alias}} {{branch}} {{item_name}} {{qty}} {{days}} {{need_amount}} {{eta}} {{link}}.
D) Behavior & guardrails
Incognito‑aware: show only scope‑allowed data.
Role‑aware: finance advisories → elders/masters; cashier sees operational tips.
Advice vs action: mascot can suggest; sensitive actions require confirm (with reason + audit).
Quiet hours + frequency caps shared with Marketing module.
Compliance tone: switch to SERIOUS for legal/PII messages.
E) UI surfaces
Settings → Mascot: name, avatar, tone, languages, color, sample messages preview.
In‑app Dock/Bubble: mascot speaks (finance digest, low‑stock, promo tips).
POS Side HUD: short mascot hints (e.g., tier applied, suggest wholesale pack).
Reports: mascot summary box with key calls to action.
F) Starter templates (examples)
Finance / Deposit Advice (INAPP, lang=fil):

 "Hi {{alias}}! Ako si {{mascot_name}}. Sales today ₱{{sales}}. May cheques due {{due_date}} (₱{{pdc_total}}). Projected bank balance ₱{{proj}} → kulang ng ₱{{need_amount}}. Suggest ko mag‑deposit bukas. Gawa ko na voucher?"



Inventory / Low in 3 days:

 "Heads‑up {{alias}} — {{item_name}} mababa na ({{days}} araw na lang). Draft ko na PO kay {{supplier}} for {{qty}}?"



Marketing / Restock Alert to customers (SMS):

 "{{alias}}, restocked na ang {{item_name}} sa {{branch}}! Baka maubusan ulit—drop by today. {{link}}"



G) Roadmap
NOW extension: Mascot settings (per Guild) + in‑app bubble delivering finance & inventory alerts we already plan.
NEXT: Channel fan‑out (SMS/email/push) using mascot templates.
LATER: A/B tone tests, feedback loop, auto‑improve copy.

Guild Mascots — Vangie Defaults & Egg Onboarding (v1)
Vangie Default
Mascot name: Kuya Agui
Tone: Friendly Taglish (≈80% English, 20% Filipino)
Colors: Teal primary (match Agui theme), warm sand accent
Starter avatar: "Teal Kuya Dragon" (SVG; swap‑able per tenant)
Sample lines:
“Hey {{alias}}! Heads‑up lang — 3 days left na lang ang mango powder sa Purok 3. I drafted a PO; want me to send it?”
“Great job today! Sales ₱{{sales}}. May PDC clearing bukas ₱{{pdc}} — suggest deposito ₱{{need}}.”
Egg Onboarding (Hatch & Bind)
Goal: Make the mascot feel earned & personal while staying functional.
Flow
Welcome gift pack → choose a Mascot Card (3–5 visual styles).
Receive a digital Egg (NFT‑like id in DB; not crypto) bound to the player entity.
Hatches on first milestone (e.g., first EOD, first PO approval, or first 100 scans).
When a new Company is created, owner is prompted to spawn a store mascot (can reuse species or pick new).
Each Company mascot files its own daily report to the Guild Master; a Guild roll‑up aggregates them.
Data model (extends Mascots v1)
mascot_species(id, code, name, default_avatar_url, default_tone, meta)
 e.g., DRAGON_KUYA, WISP_AMBALU, SPRITE_BARISTA
mascot_cards(id, species_id, style_code, front_svg_url, colors, meta)
 what users pick during welcome
mascot_eggs(id, entity_id, species_id, chosen_card_id, hatched_at, meta)
mascots (as defined) now act as instances: (id, scope_type, scope_id, species_id, name, tone, avatar_url, owner_entity_id, enabled)
mascot_events(id, mascot_id, code, payload_json, created_at)
 hatch, rename, avatar_swap, tone_change
Triggers & Milestones
Hatch when any of: first_eod, first_po_approved, first_1k_sales_day, or manual hatch by elder.
Evolve (optional): cosmetic upgrades at milestones (no pay‑to‑win; purely visual).
Guardrails
Incognito‑aware: egg & mascot respect scope permissions.
Audit on mascot‑initiated actions (reports, alerts, suggestions accepted/declined).
Export/Print: mascot card can be printed as welcome gift; QR links to /passes/member.
Company‑level Mascots
Each Company (store) owns one mascot instance by default.
Store mascots post daily store reports; Guild Mascot posts roll‑up with advisories.
Names/autonomy are per Company (e.g., Ambalu Wisp vs Vangie Kuya).
Next steps (result‑first)
Seed species + 3 cards (Vangie: DRAGON_KUYA variants).
Add Egg issuance on new player signup.
Add Hatch milestone hooks (EOD/PO).
Wire Company mascot prompt on company creation.
Show Mascot Bubble with Vangie voice lines (inventory & finance alerts already in plan).

Mascot Card Maker & Blind Pick (v1)
A) Goals
GM‑bestowed gift: Only Game Masters/Lords can mint and issue mascot cards.
Blind pick excitement: Player sees facedown cards, picks one; avatar is revealed and egg is bound to the player.
Per‑Company mascots: Each Company spawns its own mascot instance (using the player’s egg species or new spawn rules).
B) Roles & Permissions
Lord/GM: create packs, mint issuances, revoke, reissue, set rarity pools.
Guild Master: (optional) limited mint for their own guild members only.
Player: can claim if issued to them (or via claim code).
C) Data Model (lean)
mascot_species(id, code, name, default_avatar_url, default_tone, meta)
mascot_cards(id, species_id, style_code, front_svg_url, back_svg_url, rarity: COMMON|UNCOMMON|RARE|LEGENDARY, colors, meta)
card_packs(id, name, scope_type: ALLIANCE|GUILD|COMPANY, scope_id, display_slots int, rules_json)
 rules_json contains pool weights: [{species_id, style_code?, weight}] and constraints
card_issuances(id, pack_id, issued_to_entity_id nullable, issued_by_entity_id, claim_code_hash, qr_svg_url, expires_at, status: ACTIVE|CLAIMED|EXPIRED|REVOKED, meta)
card_claims(id, issuance_id, claimant_entity_id, chosen_slot int, result_species_id, result_style_code, revealed_card_id, mascot_egg_id, claimed_at, device_id, ip, user_agent)
mascot_eggs(id, entity_id, species_id, chosen_card_id, hatched_at, meta)
mascots(id, scope_type, scope_id, species_id, name, tone, avatar_url, owner_entity_id, enabled, meta)
D) Flow — GM Bestows → Player Picks → Egg Binds → Mascot Spawns
Mint: Lord/GM creates a card_pack (e.g., Vangie Starter Pack, display_slots=3) with weighted pool (rarity table).
Issue: GM mints card_issuance → generates claim code + QR (printable). Optional: assign to a specific player entity.
Claim (Blind Pick): Player opens /gift/claim/{code} → sees N facedown cards (from pack’s pool).
On pick, server draws outcome using verifiable RNG (server seed + issuance id + slot), records to card_claims.
UI reveals the selected card art; system creates mascot_eggs bound to player with species/style and stores revealed_card_id.
Hatch: On milestone (first EOD/PO/etc.), egg hatches and spawns a Mascot instance for the current scope (player profile and/or first Company).
Company Mascots: On company creation, prompt: “Use your egg species or pick a store spawn?” → creates a mascots row under that Company.
E) Security & Fairness
Single use: claim_code stored as hash; first to claim wins. Subsequent attempts: blocked, fully audited.
Expiry: issuances auto‑expire (default 7 days).
Rate limits & CAPTCHA after N failed attempts.
Verifiable RNG (commit‑reveal style): issuance stores a signed seed; claim includes slot; we log rng_trace for audit.
Offline fallback: code can be typed/scanned at POS; device signs the claim; sync later when online.
Incognito-aware: claim page shows minimal PII.
F) Rarity & Pools
Rarity weights per pack; optional guarantees (e.g., at least UNCOMMON).
Species/style pools can be scoped per Guild (Vangie‑themed art).
Supply controls: limit LEGENDARY per month; burn‑on‑claim or keep card as collectible badge.
G) Admin UI (Maker tools)
Pack Designer: choose pool entries, set weights, rarity caps, preview facedown layout.
Issuer Panel: batch mint N cards; print QR cards; export claim list.
Audit: list claims, outcomes, device info, RNG trace; revoke/reissue controls.
Theme: per Guild avatar frames/colors.
H) Player UX
Blind pick page with subtle animation, haptic feedback, confetti reveal.
After claim: show Egg in inventory with species blurb and hatch requirements.
When hatched: short animation; introduce the mascot’s voice sample (tone from species/pack).
Cards shelf: optional collectibles page for claimed cards.
I) Edge Rules
Lost gift → GM can revoke and reissue (old code invalidates).
Duplicate scans → first claim sticks; others get “already claimed.”
Multi‑device abuse → IP/device fingerprint logged; throttle.
J) Defaults for Vangie (proposal)
Pack: Vangie Starter (display_slots=3); rarity: 70% COMMON, 25% UNCOMMON, 5% RARE.
Species pool: DRAGON_KUYA (styles: Classic, Minimal, Barista).
Expiry: 7 days; per‑player limit: 1 active issuance.
K) Next (build order)
Tables above + Pack Designer UI.
Issuer Panel to mint + print QR.
Claim page (blind pick + RNG + Egg binding).
Hatch hooks + Company spawn prompt.
Mascot bubble shows reports using the chosen avatar.

Growth Model v1 — Tracks, Levels & Triggers (Not Tiered)
A) Philosophy
Not tiered. Agui grows with the business. Start ultra‑simple; unlock just‑in‑time features as signals appear. No overwhelm.
Soft locks, not walls: everything is modular “capabilities.” We suggest upgrades; owner accepts with one click (or a Skill Scroll for paid ones).
B) Structure
Tracks (arcs)


POS Core → cart, pricing, wholesale, suspend/resume, payments
Inventory → catalog, barcodes, ledger, bundles, per‑weight
Cafe/Kitchen → menu variants, modifiers, recipes, production batches
Customers → Member Pass, Guild/Patron cards, promos, marketing alerts
People → attendance, schedules, payroll
Finance → CEODR, deposits, PDC/cheques, cash projection
Intelligence → replenishment, supplier compare, forecasting, advisor
Capability Levels (per capability)


L0 Hidden (not shown)
L1 Basic (minimal UI)
L2 Standard (common options)
L3 Advanced (full power)
C) Data Model (lean)
capabilities(id, code, track, name, levels int, default_level, paid boolean, meta)
capability_prereqs(capability_id, requires_capability_id, min_level)
capability_states(scope_type: GUILD|COMPANY, scope_id, capability_id, level, status: HIDDEN|SUGGESTED|ACTIVE|SNOOZED, source: AUTO|MANUAL|SCROLL|PURCHASE, updated_at, notes)
growth_signals(scope_type, scope_id, code, value_num, value_text, occurred_at)
 (e.g., SALES_PER_DAY, ITEMS_LOW, EMPLOYEE_COUNT, RETURNS_RATE)
growth_triggers(id, capability_id, target_level, rule_json, cooldown_days, requires_accept boolean)
 Rules read signals to fire suggestions; mascot uses these.
D) Triggers (first 10 we’ll ship)
Inventory L1 when: sales_lines ≥ 200 or barcodes_used ≥ 20.
Per‑Weight L1 when: scale PLU used or manual weight lines ≥ 10.
Cafe Modifiers L1 when: company enables CAFE or creates ≥ 5 menu products.
Production Batches L1 when: modifiers referencing ingredients ≥ 3/day.
Member Pass L1 when: repeat customers ≥ 15 in 14 days.
Marketing Alerts L1 when: restocks followed by ≥ 20 queries/day.
Attendance L1 when: active staff ≥ 3 and sales shifts ≥ 2/day.
Replenishment L1 when: stockouts ≥ 3/week or items_low_in_3d ≥ 10.
Finance Advisor L1 when: POS payments include PDC or vault>threshold.
Supplier Compare L1 when: plural suppliers exist for ≥ 5 items.
Each trigger → create SUGGESTED entry in capability_states with mascot message (Accept / Snooze / Learn More). Snooze respects cooldown_days.
E) UX & Safety
Focus Mode default: only 3–5 tiles show (POS, Items, Sales, Settings). “Add more” reveals suggestions.
Guided enable: 60‑second wizard per capability (why it’s useful, what changes, defaults).
Complexity budget: max 1 new activation/day unless owner forces more.
Rollback: downgrade to previous level within 7 days (soft disable; keep data).
F) Commerce (no tiers)
Starter Seed: minimal license to run POS Core (L1) + Inventory basics (L1).
Upgrades are per‑capability; some are free, some require Skill Scroll or purchase.
Remote unlock or physical scroll both supported; still non‑tiered.
G) Examples
Sari‑sari start: POS L1 + Items L1 only. After 7 days & 250 lines → suggest Inventory L2 (ledger). After 2 low‑stock weeks → Replenishment L1.
Cafe start: POS + Cafe Modifiers L1. After recipes used daily → suggest Production Batches L1.
Growing team: when staff≥3 → Attendance L1; when payroll run needed → Payroll L1.
H) Mascot Flow
Mascot watches growth_signals and fires friendly Taglish prompts: Accept / Snooze.
Incognito & role‑aware: owners get enable prompts; cashiers get tips only.
I) Next Steps
Seed capabilities for the 7 tracks.
Implement growth_signals collectors in POS & backend.
Ship the 10 growth_triggers.
Add Upgrades panel and mascot prompts.

Agui — Foundations SQL + POS Shell v1 (Ready to Paste)
This drop includes: Foundations SQL Pack (Entities + Cards + POS base) and a minimal POS Shell (offline‑friendly, fast key input, Hold/Resume, Y/N print prompt). It’s aligned to the Growth Model, Mascots, and future modules.

1) How to run (Supabase)
Open SQL → paste each block below in order.
Keep defaults; adjust later if needed.
After running, seed test data (at the end) so /pos can demo immediately.

2) Foundations SQL Pack (Postgres / Supabase)
-- ===== PREREQS =====
create extension if not exists pgcrypto; -- for gen_random_uuid

-- ===== ENUMS =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='entity_kind') THEN
    CREATE TYPE entity_kind AS ENUM ('PERSON','ORG');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='card_scope') THEN
    CREATE TYPE card_scope AS ENUM ('GLOBAL','GUILD','COMPANY');
  END IF;
END $$;

-- ===== ENTITIES =====
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  kind entity_kind not null,
  display_name text not null,
  given_name text,
  family_name text,
  legal_name text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entity_identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  scheme text not null,         -- 'email','phone','loyalty_no','national_id', etc.
  value text not null,
  is_primary boolean not null default false,
  unique (scheme, lower(value))
);

-- ===== CARDS (Member Pass / Guild Card / Patron Pass) =====
create table if not exists public.card_schemes (
  id uuid primary key default gen_random_uuid(),
  scope card_scope not null,   -- GLOBAL, GUILD, COMPANY
  scope_id uuid,               -- nullable when GLOBAL
  name text not null,
  precedence int not null,     -- higher beats lower (GLOBAL>GUILD>COMPANY)
  allow_incognito boolean not null default true,
  design jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.card_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  card_no text not null,
  status text not null default 'active',  -- 'active','suspended','revoked'
  flags jsonb not null default '{}'::jsonb, -- {incognito_default:true}
  issued_at timestamptz not null default now(),
  unique(card_no)
);

create table if not exists public.card_tokens (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  kind text not null,           -- 'qr','barcode','nfc'
  token_hash text not null,     -- store hash only
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.benefit_accounts (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.card_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  points numeric(12,2) not null default 0,
  tier text not null default 'basic',
  balance numeric(12,2) not null default 0,
  meta jsonb not null default '{}'::jsonb,
  unique(scheme_id, entity_id)
);

-- ===== POS CATALOG (global) =====
create table if not exists public.uoms (
  code text primary key,
  name text not null,
  kind text not null default 'COUNT' -- COUNT/WEIGHT/VOLUME
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  base_uom text not null references public.uoms(code),
  attrs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.item_uoms (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  uom text not null references public.uoms(code),
  multiplier_to_base int not null check (multiplier_to_base>0),
  label text,
  unique(item_id, uom, multiplier_to_base)
);

create table if not exists public.item_kits (
  parent_item_id uuid not null references public.items(id) on delete cascade,
  child_item_id uuid not null references public.items(id) on delete restrict,
  qty_base int not null check (qty_base>0),
  primary key (parent_item_id, child_item_id)
);

create table if not exists public.item_barcodes (
  barcode text primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  item_uom_id uuid references public.item_uoms(id) on delete set null,
  note text
);

-- ===== COMPANY PRICES & INVENTORY =====
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid,
  name text not null,
  slug text unique,
  capabilities text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.company_prices (
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id),
  uom text not null references public.uoms(code),
  unit_price numeric(12,2) not null,
  primary key (company_id, item_id, uom)
);

create table if not exists public.company_price_tiers (
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id),
  min_base_qty int not null,
  unit_price_base numeric(12,2) not null,
  primary key (company_id, item_id, min_base_qty)
);

create table if not exists public.company_item_costs (
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id),
  avg_cost_base numeric(12,2) not null default 0,
  primary key (company_id, item_id)
);

create table if not exists public.inventory_txns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id),
  qty_base int not null,           -- negative on sale
  cost_base numeric(12,2) not null,
  reason text not null,            -- 'SALE','PURCHASE','ADJUST','RETURN'
  ref_doc text,
  created_at timestamptz not null default now()
);

-- ===== POS SALES (server sync target) =====
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  device_id text not null,
  status text not null default 'OPEN', -- OPEN|HELD|COMPLETED|VOID
  grand_total numeric(12,2) not null default 0,
  seq_no int,                          -- register sequence
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  line_no int not null,
  item_id uuid not null references public.items(id),
  uom text not null references public.uoms(code),
  multiplier_to_base int not null,
  qty numeric(12,3) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  mode text not null,                 -- CASH, GCash, etc.
  amount numeric(12,2) not null,
  ref_no text,
  ref_date date,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.sale_holds (
  sale_id uuid primary key references public.sales(id) on delete cascade,
  reason text,
  hold_by_entity_id uuid,
  hold_device_id text,
  hold_token text,                    -- short code / QR string
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== PAYMENT MODES =====
create table if not exists public.company_payment_modes (
  company_id uuid not null references public.companies(id) on delete cascade,
  mode text not null,
  enabled boolean not null default true,
  details_json jsonb not null default '{}'::jsonb,
  primary key (company_id, mode)
);

create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payee text, bank text, check_no text, amount numeric(12,2) not null,
  due_date date not null,
  status text not null default 'ISSUED', -- ISSUED|CLEARED|BOUNCED|CANCELLED
  memo text,
  created_at timestamptz not null default now()
);

-- ===== INDEXES =====
create index if not exists idx_identifiers_scheme_value on public.entity_identifiers (scheme, lower(value));
create index if not exists idx_item_barcodes_item on public.item_barcodes (item_id);
create index if not exists idx_price_company_item on public.company_prices (company_id, item_id);
create index if not exists idx_txn_company_item on public.inventory_txns (company_id, item_id);
create index if not exists idx_sales_company_status on public.sales (company_id, status, updated_at desc);

-- ===== RLS: enable + permissive starter policies (tighten later) =====
alter table public.entities enable row level security;
alter table public.entity_identifiers enable row level security;
alter table public.card_schemes enable row level security;
alter table public.cards enable row level security;
alter table public.card_tokens enable row level security;
alter table public.benefit_accounts enable row level security;
alter table public.uoms enable row level security;
alter table public.items enable row level security;
alter table public.item_uoms enable row level security;
alter table public.item_kits enable row level security;
alter table public.item_barcodes enable row level security;
alter table public.companies enable row level security;
alter table public.company_prices enable row level security;
alter table public.company_price_tiers enable row level security;
alter table public.company_item_costs enable row level security;
alter table public.inventory_txns enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.sale_payments enable row level security;
alter table public.sale_holds enable row level security;
alter table public.company_payment_modes enable row level security;
alter table public.cheques enable row level security;

DO $$ BEGIN
  PERFORM 1; -- Parties: read
  BEGIN CREATE POLICY p_select ON public.entities FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN END;
  BEGIN CREATE POLICY p_insupd ON public.entities FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN END;

  BEGIN CREATE POLICY id_select ON public.entity_identifiers FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN END;
  BEGIN CREATE POLICY id_all    ON public.entity_identifiers FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated'); EXCEPTION WHEN duplicate_object THEN END;

  -- Repeat for others (starter, same pattern)
  BEGIN CREATE POLICY any_select ON public.items FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN END;
  BEGIN CREATE POLICY any_all    ON public.items FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated'); EXCEPTION WHEN duplicate_object THEN END;
END $$;

Seed (minimal demo)
-- UOMs
insert into uoms(code,name) values
  ('PCS','Piece'),('ROLL','Roll'),('BUNDLE','Bundle'),('CASE','Case'),
  ('KG','Kilogram')
on conflict do nothing;

-- Company
insert into companies(name, slug) values ('Vangie Variety Store','vangie-store') on conflict do nothing;

-- Item: Bear Brand Swak 30g
insert into items (name, brand, base_uom)
values ('Bear Brand Swak 30g','Bear Brand','PCS')
returning id;
-- Suppose it returns :item_id (get it via SELECT later if needed)

-- Packs
insert into item_uoms(item_id,uom,multiplier_to_base,label)
select id,'PCS',1,null from items where name='Bear Brand Swak 30g' on conflict do nothing;
insert into item_uoms(item_id,uom,multiplier_to_base,label)
select id,'ROLL',8,null from items where name='Bear Brand Swak 30g' on conflict do nothing;
insert into item_uoms(item_id,uom,multiplier_to_base,label)
select id,'BUNDLE',10,'10/30g' from items where name='Bear Brand Swak 30g' on conflict do nothing;
insert into item_uoms(item_id,uom,multiplier_to_base,label)
select id,'CASE',60,'6/10/30g' from items where name='Bear Brand Swak 30g' on conflict do nothing;

-- Barcodes
insert into item_barcodes(barcode,item_id,item_uom_id,note)
select '4901234567890', i.id, iu.id, 'PCS EAN'
from items i join item_uoms iu on iu.item_id=i.id and iu.uom='PCS'
where i.name='Bear Brand Swak 30g'
on conflict do nothing;
insert into item_barcodes(barcode,item_id,item_uom_id,note)
select 'BB-SWAK-ROLL', i.id, iu.id, '8 pcs roll'
from items i join item_uoms iu on iu.item_id=i.id and iu.uom='ROLL'
where i.name='Bear Brand Swak 30g'
on conflict do nothing;
insert into item_barcodes(barcode,item_id,item_uom_id,note)
select '4901234567891', i.id, iu.id, 'Bundle 10'
from items i join item_uoms iu on iu.item_id=i.id and iu.uom='BUNDLE'
where i.name='Bear Brand Swak 30g'
on conflict do nothing;

-- Prices (as example)
insert into company_prices(company_id,item_id,uom,unit_price)
select c.id, i.id, 'PCS', 12.00 from companies c, items i where c.slug='vangie-store' and i.name='Bear Brand Swak 30g'
on conflict (company_id,item_id,uom) do update set unit_price=excluded.unit_price;
insert into company_prices(company_id,item_id,uom,unit_price)
select c.id, i.id, 'ROLL', 92.00 from companies c, items i where c.slug='vangie-store' and i.name='Bear Brand Swak 30g'
on conflict (company_id,item_id,uom) do update set unit_price=excluded.unit_price;
insert into company_price_tiers(company_id,item_id,min_base_qty,unit_price_base)
select c.id, i.id, 8, 11.50 from companies c, items i where c.slug='vangie-store' and i.name='Bear Brand Swak 30g'
on conflict do nothing;

-- Payment modes
insert into company_payment_modes(company_id,mode,enabled)
select id,'CASH',true from companies where slug='vangie-store' on conflict do nothing;
insert into company_payment_modes(company_id,mode,enabled)
select id,'GCash',true from companies where slug='vangie-store' on conflict do nothing;


3) POS Shell (React/Next) — files to paste
Minimal, fast, keyboard‑driven. Offline storage stubbed with LocalStorage (can swap to Dexie/SQLite OPFS later). Includes: qty prefix (6*), Insert duplicate, F11 wholesale chooser, Hold/Resume (local), and finalize with Y/N print prompt.
src/lib/pos/types.ts
export type UOM = 'PCS'|'ROLL'|'BUNDLE'|'CASE'|'KG';
export type CartLine = {
  id: string;
  itemId: string;
  name: string;
  uom: UOM;
  multiplierToBase: number; // e.g., 8 for ROLL
  qty: number;              // qty in chosen UOM
  unitPrice: number;        // price per chosen UOM
  lineTotal: number;        // qty * unitPrice
};
export type Keymap = Record<string,string[]>;
export type WholesaleOption = { uom: UOM; multiplier: number; price?: number; cost?: number };

src/lib/pos/keymap.ts
const keymap: Record<string,string[]> = {
  QTY_PREFIX: ['*'],
  DUPLICATE_LAST: ['Insert'],
  WHOLESALE_TOGGLE: ['F11'],
  HOLD_SALE: ['F9'],
  FINALIZE: ['F12'],
  PRINT_Y: ['y','Y'],
  PRINT_N: ['n','N']
};
export default keymap;

src/lib/pos/engine.ts
import type { CartLine, UOM, WholesaleOption } from './types';

export type CatalogEntry = {
  itemId: string; name: string; basePrice: number; // per PCS
  uoms: { uom: UOM; multiplier: number; price?: number }[];
  tiers?: { minBaseQty: number; unitPriceBase: number }[]; // e.g., 8 → 11.50
};

export function bestTierBasePrice(totalBase: number, tiers?: {minBaseQty:number; unitPriceBase:number}[]) {
  if (!tiers?.length) return undefined;
  const eligible = tiers.filter(t => totalBase >= t.minBaseQty).sort((a,b)=>b.minBaseQty-a.minBaseQty);
  return eligible[0]?.unitPriceBase;
}

export function repriceCart(cart: CartLine[], catalog: Record<string,CatalogEntry>) {
  // 1) totals per item in base units
  const baseTotals = new Map<string, number>();
  for (const line of cart) {
    const add = (line.qty * line.multiplierToBase);
    baseTotals.set(line.itemId, (baseTotals.get(line.itemId) ?? 0) + add);
  }
  // 2) reprice
  for (const line of cart) {
    const entry = catalog[line.itemId];
    const totalBase = baseTotals.get(line.itemId) ?? 0;
    const tierBase = bestTierBasePrice(totalBase, entry.tiers);
    if (tierBase !== undefined) {
      line.unitPrice = round2(tierBase * line.multiplierToBase);
    } else {
      const explicit = entry.uoms.find(u => u.uom === line.uom)?.price;
      line.unitPrice = round2((explicit ?? entry.basePrice) * line.multiplierToBase);
    }
    line.lineTotal = round2(line.qty * line.unitPrice);
  }
}

export function resolveBarcode(barcode: string, catalog: Record<string,CatalogEntry>): {itemId:string; name:string; uom:UOM; multiplier:number} | null {
  // DEMO: simple map; replace with real lookup
  const map: Record<string,{itemId:string;uom:UOM;multiplier:number}> = {
    '4901234567890': { itemId: 'BEAR30', uom: 'PCS', multiplier: 1 },
    'BB-SWAK-ROLL':  { itemId: 'BEAR30', uom: 'ROLL', multiplier: 8 },
    '4901234567891': { itemId: 'BEAR30', uom: 'BUNDLE', multiplier: 10 }
  };
  const r = map[barcode];
  if (!r) return null;
  const name = catalog[r.itemId]?.name ?? 'Unknown';
  return { itemId: r.itemId, name, uom: r.uom, multiplier: r.multiplier };
}

export function wholesaleOptions(itemId: string, catalog: Record<string,CatalogEntry>): WholesaleOption[] {
  const entry = catalog[itemId];
  return (entry?.uoms ?? []).map(u => ({ uom: u.uom, multiplier: u.multiplier, price: u.price }));
}

export function round2(n:number){ return Math.round(n*100)/100; }

src/app/pos/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import keymap from '@/lib/pos/keymap';
import { repriceCart, resolveBarcode, wholesaleOptions, round2, type CatalogEntry } from '@/lib/pos/engine';
import type { CartLine, UOM } from '@/lib/pos/types';

const demoCatalog: Record<string, CatalogEntry> = {
  BEAR30: {
    itemId: 'BEAR30', name: 'Bear Brand Swak 30g', basePrice: 12.00,
    uoms: [ {uom:'PCS', multiplier:1, price:12.00}, {uom:'ROLL', multiplier:8, price:92.00}, {uom:'BUNDLE', multiplier:10} ],
    tiers: [ {minBaseQty:8, unitPriceBase:11.50} ]
  }
};

export default function POSPage(){
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lastLineId, setLastLineId] = useState<string|undefined>(undefined);
  const [wholesale, setWholesale] = useState(false);
  const [qtyPrefix, setQtyPrefix] = useState<number|undefined>(undefined);
  const [held, setHeld] = useState<any[]>(() => JSON.parse(localStorage.getItem('held_sales')||'[]'));
  const [finalizePrompt, setFinalizePrompt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyTimer = useRef<NodeJS.Timeout|undefined>(undefined);

  useEffect(()=>{ inputRef.current?.focus(); },[]);
  useEffect(()=>{ localStorage.setItem('held_sales', JSON.stringify(held)); },[held]);

  function addOrInc(itemId:string, name:string, uom:UOM, multiplier:number, qty:number){
    setCart(prev => {
      const last = lastLineId ? prev.find(x=>x.id===lastLineId) : undefined;
      const canMerge = last && last.itemId===itemId && last.uom===uom && qtyPrefix===undefined;
      if (canMerge){
        last.qty += 1; // auto-increment
        const next = [...prev];
        repriceCart(next, demoCatalog);
        return next;
      }
      const line: CartLine = {
        id: crypto.randomUUID(), itemId, name, uom, multiplierToBase: multiplier,
        qty, unitPrice: 0, lineTotal: 0
      };
      const next = [...prev, line];
      repriceCart(next, demoCatalog);
      setLastLineId(line.id);
      return next;
    });
  }

  function onBarcode(scanned:string){
    const r = resolveBarcode(scanned, demoCatalog);
    if(!r) return; // unknown
    const qty = qtyPrefix ?? 1;
    if (wholesale){
      const options = wholesaleOptions(r.itemId, demoCatalog);
      const pick = options.find(o=>o.uom===r.uom) || options[0]; // demo: auto-pick first
      addOrInc(r.itemId, r.name, pick.uom as UOM, pick.multiplier, qty);
    }else{
      addOrInc(r.itemId, r.name, r.uom as UOM, r.multiplier, qty);
    }
    setQtyPrefix(undefined);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>){
    const key = e.key;
    if (key===keymap.WHOLESALE_TOGGLE[0]){ setWholesale(w=>!w); return; }
    if (key===keymap.DUPLICATE_LAST[0]){ duplicateLast(); return; }
    if (key===keymap.HOLD_SALE[0]){ holdSale(); return; }
    if (key===keymap.FINALIZE[0]){ setFinalizePrompt(true); return; }

    // qty prefix: digits then '*'
    if (/^[0-9]$/.test(key)){
      const cur = (qtyPrefix ?? 0);
      const next = cur*10 + Number(key);
      setQtyPrefix(next);
      if (qtyTimer.current) clearTimeout(qtyTimer.current);
      qtyTimer.current = setTimeout(()=> setQtyPrefix(undefined), 2000);
      return;
    }
    if (key===keymap.QTY_PREFIX[0]){ /* just marker, wait for scan */ return; }

    // emulate scanner: Enter ends the code; demo: use input value as full barcode
    if (key==='Enter'){
      const val = (e.target as HTMLInputElement).value.trim();
      if (val) onBarcode(val);
      (e.target as HTMLInputElement).value='';
    }
  }

  function duplicateLast(){
    setCart(prev=>{
      if (!lastLineId) return prev;
      const last = prev.find(x=>x.id===lastLineId);
      if (!last) return prev;
      const copy = { ...last, id: crypto.randomUUID() };
      const next = [...prev, copy];
      repriceCart(next, demoCatalog);
      setLastLineId(copy.id);
      return next;
    });
  }

  function holdSale(){
    if (!cart.length) return;
    const sale = { id: crypto.randomUUID(), lines: cart, at: new Date().toISOString(), status:'HELD_LOCAL' };
    setHeld(h=>[sale, ...h].slice(0,30));
    setCart([]);
    setLastLineId(undefined);
  }

  function resumeSale(sale:any){
    setCart(sale.lines);
    setLastLineId(sale.lines[sale.lines.length-1]?.id);
    setHeld(h=>h.filter(x=>x.id!==sale.id));
  }

  const grand = useMemo(()=> round2(cart.reduce((s,l)=>s+l.lineTotal,0)),[cart]);

  function finalizeSale(){
    // Demo only: clear cart and show print prompt
    setFinalizePrompt(true);
  }

  function onPrintChoice(yes:boolean){
    // Hook printer or skip; reset cart
    if (yes){ /* window.print() or open receipt */ }
    setFinalizePrompt(false);
    setCart([]);
    setLastLineId(undefined);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Agui POS (Shell)</h1>
      <div className="mt-2 text-sm opacity-70">Qty prefix: type digits then <kbd>*</kbd>. Insert = duplicate. F11 = wholesale. F9 = hold. F12 = finalize.</div>

      <div className="mt-4 flex items-center gap-3">
        <input ref={inputRef} onKeyDown={onKeyDown} placeholder="Scan barcode then Enter…" className="border rounded-xl px-3 py-2 w-80" />
        <span className={"text-xs px-2 py-1 rounded-full border "+(wholesale?"bg-black text-white":"")}>{wholesale? 'WHOLESALE' : 'RETAIL'}</span>
        {qtyPrefix!==undefined && <span className="text-xs px-2 py-1 rounded-full border">{qtyPrefix}*</span>}
      </div>

      <div className="mt-6 grid gap-2">
        {cart.map((l,i)=> (
          <div key={l.id} className="border rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{l.name} <span className="opacity-60 text-xs">({l.uom})</span></div>
              <div className="text-xs opacity-70">{l.qty} × ₱{l.unitPrice.toFixed(2)}</div>
            </div>
            <div className="font-semibold">₱{l.lineTotal.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={holdSale} className="border rounded-xl px-4 py-2">Hold (F9)</button>
        <div className="text-xl font-bold">Grand Total: ₱{grand.toFixed(2)}</div>
        <button onClick={finalizeSale} className="border rounded-xl px-4 py-2">Finalize (F12)</button>
      </div>

      {/* Held list */}
      {held.length>0 && (
        <div className="mt-8">
          <div className="font-semibold mb-2">Held Sales</div>
          <div className="grid gap-2">
            {held.map(s=> (
              <div key={s.id} className="border rounded-xl p-3 flex items-center justify-between">
                <div className="text-sm">Held @ {new Date(s.at).toLocaleString()}</div>
                <button onClick={()=>resumeSale(s)} className="border rounded-lg px-3 py-1 text-sm">Resume</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finalize Print Prompt */}
      {finalizePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-[360px]">
            <div className="text-lg font-semibold mb-2">Print receipt?</div>
            <div className="text-sm opacity-70 mb-4">Press <b>Y</b> for Yes or <b>N</b> for No.</div>
            <div className="flex gap-2">
              <button onClick={()=>onPrintChoice(true)} className="border rounded-xl px-4 py-2">Yes (Y)</button>
              <button onClick={()=>onPrintChoice(false)} className="border rounded-xl px-4 py-2">No (N)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


4) What’s next (after paste)
Run SQL blocks (top → bottom).
Create the 3 files under src/lib/pos/… and src/app/pos/page.tsx.
Start dev and open /pos. Try: type 6*, then paste a demo barcode (4901234567890) then Enter → adds 6 pcs. Press Enter again with BB-SWAK-ROLL → merges as roll and reprices when ≥8 pcs.
Press Insert to duplicate; F11 to toggle wholesale; F9 to Hold; F12 to finalize → Y/N prompt.
This shell is intentionally lean (no server sync yet). Next drops will add: Dexie/SQLite OPFS local DB, service worker cache, cross‑device resume, payments split UI, and the Growth signals + Mascot bubble.
Yes—lahat ng napag-usapan natin naka-encode na sa master plan. 🚀
I just dropped the Foundations SQL + POS Shell v1 into our canvas:
Foundations SQL Pack (Entities, Identifiers, Card Schemes/Cards/Tokens, Catalog + UOM, Prices/Tiers, Inventory, Sales/Holds/Payments, starter RLS + indexes, seed data for Bear Brand).
POS Shell (React) with qty prefix (6*), auto-increment, Insert duplicate, F11 wholesale toggle, Hold/Resume, and Finalize → Print? (Y/N) prompt.
Quick start (now)
In Supabase → run the SQL blocks top to bottom (in the canvas).
Add the code files (also in the canvas) to your repo under the shown paths.
Run your dev server and open /pos.
Try: type 6*, scan/paste 4901234567890, press Enter → adds 6 pcs.
Insert duplicates last line, F11 toggles wholesale, F9 holds, F12 finalizes → Y/N prompt.
After you confirm it’s running, I’ll follow with:
Offline local DB (Dexie/SQLite OPFS) + service worker,
Split payments UI + modes toggle,
Growth signals + Kuya Agui mascot bubble (friendly Taglish),
Customer 360 + Cases (read-only),
Replenishment v1 (auto PO draft + supplier compare).
Kung may gusto kang baguhin sa naming/flow habang nagta-try ka, sabihin mo lang—ready akong mag-drop ng full replacements.

