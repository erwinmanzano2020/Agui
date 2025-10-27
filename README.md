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

### Manual steps after this PR deploys to Preview

1. **Run SQL:** In Supabase → SQL Editor, run both migration SQL files (copy/paste content).
2. **Bootstrap GM (choose your preview URL):**

   ```bash
   curl -X POST 'https://<your-preview>.vercel.app/api/admin/bootstrap-gm' \
     -H 'x-admin-secret: <ADMIN_BOOTSTRAP_SECRET>'
   ```

3. **Sign in** with `GM_EMAIL` on the preview site → open `/admin`.
