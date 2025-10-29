#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "❌ ripgrep (rg) is required for zod import checks." >&2
  exit 1
fi

mapfile -t SCHEMA_FILES < <(
  rg -l --glob 'src/**/*.{ts,tsx}' \
    '(z\.(object|string|number|boolean|unknown|array|union|literal|record|tuple|nullable|optional|never|void|enum))\('\
    || true
)

if [ ${#SCHEMA_FILES[@]} -eq 0 ]; then
  echo "✅ no schema files detected; skipping zod import check."
  exit 0
fi

FAIL=0
for file in "${SCHEMA_FILES[@]}"; do
  if rg -q "import\\s+type\\s+(\\*\\s+as\\s+z|\\{[^}]*\\bz\\b[^}]*\\})\\s+from\\s+\\\"zod\\\"" "$file"; then
    echo "❌ Type-only zod import in schema file: $file"
    FAIL=1
  fi
  if ! rg -q "import\\s+\\{\\s*z\\s*\\}\\s+from\\s+\\\"zod\\\"" "$file"; then
    echo "❌ Schema file missing value import for zod: $file"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "❌ Refusing to build: schema files must value-import zod via \`import { z } from \"zod\"\`." >&2
  exit 1
fi

echo "✅ zod imports look good."
