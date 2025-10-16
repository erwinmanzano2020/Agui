#!/usr/bin/env bash
set -euo pipefail

ROOT="agui-starter"

FILES=(
  "$ROOT/src/app/providers/theme-provider.tsx"
  "$ROOT/src/components/ui/button.tsx"
  "$ROOT/src/components/ui/card.tsx"
  "$ROOT/src/components/ui/themed-link.tsx"
  "$ROOT/src/components/ui/input.tsx"
  "$ROOT/src/components/ui/toaster.tsx"
  "$ROOT/src/app/layout.tsx"
  "$ROOT/src/app/globals.css"
)

echo "▶ Checking theme/token files…"
missing=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ MISSING: $f"
    missing=1
  else
    echo "✅ $f"
  fi
done

echo
echo "▶ Grepping for token classes in code…"
rg -n "agui-(sidebar|nav|navlink|table|input|empty|toast)" agui-starter/src || true

echo
echo "▶ Quick TypeScript/Next build check…"
npm --prefix agui-starter run build || true

if [[ $missing -ne 0 ]]; then
  echo
  echo "⛔ Some files are missing. Tell me which ❌ lines you saw and I’ll drop full replacements."
  exit 1
fi

echo
echo "🎉 Theme/token layer appears present. If the build surfaced errors above, paste the first error block here."
