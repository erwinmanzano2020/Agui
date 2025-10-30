// IMPORTANT: Do NOT import zod/valibot or any schema barrel here.
// Only plain runtime code. If you must validate, do it with simple guards.

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export async function getPatronPass(slug: string) {
  const s = slug.trim();

  if (!isNonEmptyString(s)) return null;

  const demo = {
    companyName: s.toUpperCase(),
    active: !s.endsWith("-inactive"),
    passId: `PASS_${s.slice(0, 24)}`,
    note: "Runtime-only loader (no top-level schema). Replace with real data source.",
  };

  return demo;
}
