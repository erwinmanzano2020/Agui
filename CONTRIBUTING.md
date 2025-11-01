# Contributing Notes

- **Zod imports:** Never import `zod` directly. Always use the facade:
  ```ts
  import { z, stringEnum } from "@/lib/z";
  ```

- **Build locally:**

  ```bash
  npm ci
  npm run build
  ```

- **CI/Vercel:** Uses `npm ci` for reproducible installs.

## Zod Facade
- Do not import from `"zod"` directly. Use `@/lib/z`.
- CI enforces lint + build; Vercel uses `npm ci`.
- If a file sneaks in a direct import, run:

```
node tools/codemods/zod-facade-rewrite.mjs src
npm run lint -- --fix
```
