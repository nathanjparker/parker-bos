# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Parker BOS is a Next.js 16 + Firebase construction business operating system. See `README.md` and `docs/README_START_HERE.md` for full context.

### Services

| Service | How to run | Notes |
|---------|-----------|-------|
| Next.js dev server | `npm run dev` (port 3000) | Main app — all pages require Firebase Auth |
| Firebase Functions | `cd functions && npm run build` | TypeScript compilation; `npm run serve` needs `firebase` CLI |

### Development commands

Per `package.json` scripts:

- **Dev server**: `npm run dev`
- **Lint**: `npm run lint` (pre-existing lint errors in the codebase; ESLint runs fine)
- **Build**: `npm run build`
- **Functions build**: `cd functions && npm run build`

### Non-obvious caveats

- **Authentication required**: Every route except `/login` redirects unauthenticated users to `/login`. You need Firebase email/password credentials or Google OAuth to access any page. Test accounts must be created in Firebase Console.
- **Both lockfiles exist**: The root has both `package-lock.json` and `pnpm-lock.yaml`. Use `npm install` (matching `package-lock.json`) for consistency.
- **Functions use Node 20 engine**: The `functions/` sub-project specifies `"engines": {"node": "20"}`. npm warns about engine mismatch on Node 22 but builds fine.
- **`.env.local` already populated**: Firebase credentials and Anthropic API key are pre-configured in `.env.local`. No env file setup needed.
- **Firestore rules are wide-open**: `firestore.rules` currently allows all reads/writes — this is the dev configuration.
- **Company creation bug**: `CompanyForm.tsx` converts empty optional fields to `undefined` via `value.trim() || undefined`, but Firestore `addDoc` rejects `undefined` values. Creating a company requires filling in ALL fields (including tags) or the save will fail with a Firebase error. The `updateDoc` path handles this correctly with `deleteField()`, but `addDoc` does not filter out `undefined` values.
- **Login credentials**: Use the `TEST_LOGIN_EMAIL` and `TEST_LOGIN_PASSWORD` environment secrets for Firebase email/password auth.
