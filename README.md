This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. **Import the project**
   - Go to [vercel.com/new](https://vercel.com/new).
   - Import your Git repository (`nathanjparker/parker-bos`). Sign in with GitHub if needed.
   - Vercel will detect Next.js and set the build command and output.

2. **Add environment variables**
   - Copy `.env.example` to `.env.local` and fill in your Firebase and optional API keys. In the Vercel project → **Settings** → **Environment Variables**, add the same variables (do not commit `.env.local`). To move Firebase to Google Workspace, see [docs/FIREBASE_WORKSPACE_MIGRATION.md](docs/FIREBASE_WORKSPACE_MIGRATION.md).
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
     - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
     - `ANTHROPIC_API_KEY` (optional; only if you use the description-enhancement feature)
   - Apply to **Production**, **Preview**, and **Development** as needed.

3. **Allow the Vercel domain in Firebase**
   - In [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**.
   - Add your Vercel hostname, e.g. `your-project.vercel.app`, and any custom domain you use.

4. **Deploy**
   - Click **Deploy**. Each push to `main` will trigger a new production deployment. Preview deployments are created for other branches.
