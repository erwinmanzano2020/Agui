import Link from "next/link";
import { notFound } from "next/navigation";

type PageParams = { params: { slug?: string } };

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * IMPORTANT: Do NOT import schema barrels here.
 * Any heavy logic must be dynamically imported inside the component.
 */
export default async function PatronPassPage({ params }: PageParams) {
  const slug = isNonEmptyString(params?.slug) ? params!.slug!.trim() : "";

  if (!slug) {
    // No slug → 404
    notFound();
  }

  // Lazy-load a runtime-only helper (no zod/valibot at module scope).
  let getPatronPass:
    | ((slug: string) => Promise<{
        companyName: string;
        active: boolean;
        passId?: string;
        note?: string;
      } | null>)
    | null = null;

  try {
    const mod = await import("@/lib/patron/pass-runtime"); // must be schema-free at import time
    if (typeof mod.getPatronPass === "function") getPatronPass = mod.getPatronPass;
  } catch {
    // swallow: treat as unavailable, render fallback UI
  }

  let data:
    | {
        companyName: string;
        active: boolean;
        passId?: string;
        note?: string;
      }
    | null = null;

  if (getPatronPass) {
    try {
      data = await getPatronPass(slug);
    } catch {
      // fall through to null
    }
  }

  const companyName = data?.companyName ?? slug;
  const active = !!data?.active;
  const passId = data?.passId ?? undefined;
  const note = data?.note ?? undefined;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Patron Pass</h1>
        <p className="text-sm opacity-80">
          Company: <span className="font-medium">{companyName}</span>
        </p>
      </div>

      {!data && (
        <div className="rounded-xl border p-4">
          <p className="mb-2">We couldn’t load the Patron Pass details right now.</p>
          <ul className="list-disc list-inside text-sm opacity-80">
            <li>Check if the company exists and has a Patron Pass configured.</li>
            <li>Try again later or contact support.</li>
          </ul>
        </div>
      )}

      {data && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm opacity-80">Status</span>
            <span
              className={`text-sm font-medium ${
                active ? "text-green-600" : "text-amber-600"
              }`}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>
          {passId && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-80">Pass ID</span>
              <span className="text-sm font-mono">{passId}</span>
            </div>
          )}
          {note && <p className="text-sm opacity-80 pt-2 border-t">{note}</p>}
        </div>
      )}

      <div className="pt-2">
        <Link href={`/company/${encodeURIComponent(slug)}`} className="underline">
          Back to company
        </Link>
      </div>
    </main>
  );
}
