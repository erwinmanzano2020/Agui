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
