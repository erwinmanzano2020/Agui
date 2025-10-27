Welcome to the NextJS base template bootstrapped using the `create-next-app`. This template supports TypeScript, but you can use normal JavaScript as well.

## Getting Started

Hit the run button to start the development server.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on `/api/hello`. This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Productionizing your Next App

To make your next App run smoothly in production make sure to deploy your project with [Repl Deployments](https://docs.replit.com/hosting/deployments/about-deployments)!

You can also produce a production build by running `npm run build` and [changing the run command](https://docs.replit.com/programming-ide/configuring-repl#run) to `npm run start`.

## GM Bootstrap

### Env Vars (set in Vercel, All Environments)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `GM_EMAIL` (your email)
- `ADMIN_BOOTSTRAP_SECRET` (long random string)
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` (defaults to `true`)
- `NEXT_PUBLIC_AUTH_APPLE_ENABLED` (set to `true` once credentials are ready)

Supabase Auth redirect URLs should include `https://*.vercel.app/*`, your production domain, and `http://localhost:3000/*`. The app
derives its runtime site URL automatically, with an optional `NEXT_PUBLIC_SITE_URL` fallback for server-side contexts.

### OAuth Providers

- **Google:** Create an OAuth Client ID (web) and add these authorized redirect URIs:
  - `https://*.vercel.app/auth/v1/callback`
  - `https://<your-prod-domain>/auth/v1/callback`
  - `http://localhost:3000/auth/v1/callback`
- **Apple:** Configure a Services ID / bundle ID, key, and team ID. Use the same callback URLs as Google.
- In Supabase → **Auth → Providers**, paste the credentials for each provider and enable them.
- In Vercel → **Project → Settings → Environment Variables**, add:
  - `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`
  - `NEXT_PUBLIC_AUTH_APPLE_ENABLED=false` (flip to `true` when the Apple configuration is complete)
- Confirm Supabase **Auth → URL Configuration → Redirect URLs** includes:
  - `https://*.vercel.app/*`
  - `https://<your-prod-domain>/*`
  - `http://localhost:3000/*`

### Manual steps after this PR deploys to Preview

1. **Run SQL:** In Supabase → SQL Editor, run both migration SQL files (copy/paste content).
2. **Bootstrap GM (choose your preview URL):**

   ```bash
   curl -X POST 'https://<your-preview>.vercel.app/api/admin/bootstrap-gm' \
     -H 'x-admin-secret: <ADMIN_BOOTSTRAP_SECRET>'
   ```

3. **Sign in** with `GM_EMAIL` on the preview site → open `/admin`.
