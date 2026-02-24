# Move Firebase Project to Google Workspace

This guide covers moving Firebase project ownership from a personal Google account to a Google Workspace (organization) account.

**Two options:**

- **Transfer ownership** of the existing project — keeps project ID, all data, and current env vars; no app changes.
- **Create a new project** under Workspace — new project ID and config; requires updating env vars and optionally migrating data.

**Recommendation:** Use **Transfer** if you want to keep existing Firestore data, Auth users, and avoid any app or env changes. Use **new project** only if you want a clean project under the org and can re-create users/data.

---

## Option 1: Transfer existing project to Workspace (recommended)

No code or config changes. All steps are in Google Cloud Console.

### Steps

1. **Sign in to Google Cloud with your Workspace account**
   - Go to [Google Cloud Console](https://console.cloud.google.com).
   - Use your Workspace email (e.g. you@company.com). Switch account or add it if needed.

2. **Open the current Firebase project**
   - Select project **parker-bos** (or ensure the project is in the same organization you want).

3. **Link project to your Workspace organization (if not already)**
   - **IAM & Admin** → **Settings** (or **Organization**).
   - If the project is under "No organization", you can:
     - **Move the project**: In Cloud Console, use **⋮** next to the project → **Move** and choose your Workspace org (if your org allows it), or
     - **Grant ownership to Workspace**: Add your Workspace account (or a group like admins@company.com) as **Owner** so the org effectively controls the project.

4. **Add Workspace identity as Owner**
   - **IAM & Admin** → **IAM**.
   - **Grant access**: add your Workspace user (e.g. you@company.com) or a Workspace group with role **Owner**.
   - Optionally remove your personal account from Owner once the Workspace account is confirmed.

5. **Billing (optional)**
   - **Billing** → link the project to a billing account owned by your Workspace if you want charges to go to the org.

6. **No app changes**
   - Project ID and all Firebase config stay the same. `.env.local` and Vercel env vars do not need updates.

---

## Option 2: Create a new Firebase project under Workspace

Use this if you prefer a new project under the org (e.g. different project ID, fresh start). Requires updating config everywhere and optionally migrating data.

### 2.1 Create and configure the new project (Firebase Console)

1. Sign in to [Firebase Console](https://console.firebase.google.com) with your **Workspace account**.
2. **Add project** → choose or create a Google Cloud org under Workspace → name the project (e.g. `parker-bos-workspace`).
3. **Authentication** → enable **Google** and **Email/Password** (same as current app login).
4. **Firestore** → create database (same mode as current: test or production).
5. **Storage** → enable if you use uploads.
6. **Project settings** → **General** → **Your apps** → add a **Web** app → copy the new config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId if used).
7. **Authentication** → **Settings** → **Authorized domains** → add your Vercel domain (e.g. your-project.vercel.app or your custom domain) and `localhost` for local dev.

### 2.2 Update app and deployment config

- **Local**: Copy `.env.example` to `.env.local` and replace all `NEXT_PUBLIC_FIREBASE_*` values with the new project's web app config. Do not commit `.env.local`.
- **Vercel**: Project → **Settings** → **Environment Variables** → update the same `NEXT_PUBLIC_FIREBASE_*` (leave `ANTHROPIC_API_KEY` as-is if unchanged). Redeploy so the new build uses the new vars.
- **Firebase CLI / Cloud Functions**: If you deploy from `functions/`, run `firebase use <new-project-id>` (and optionally `firebase login` with Workspace), then `firebase deploy --only functions` so functions run in the new project.

### 2.3 Users and data

- **Auth**: Re-create user accounts in the new project (Firebase does not support moving users between projects). Create the same email/password users in **Authentication** → **Users**; users can sign in with Google again (they will get new UIDs in the new project).
- **Firestore/Storage**: To keep data, use export/import (Firestore: `gcloud firestore export` / `import`; Storage: copy objects to the new bucket). Otherwise start with empty Firestore/Storage.

---

## Summary

| Approach                | Code / env changes                                                    | Data / users                                          |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| **Transfer (Option 1)** | None                                                                  | Unchanged                                             |
| **New project (Option 2)** | Update `.env.local` and Vercel env vars; `firebase use` for functions | Re-create users; optionally migrate Firestore/Storage |

No changes to `src/app/login/page.tsx` or `src/lib/firebase.ts` are required for either option; the app only reads `process.env.NEXT_PUBLIC_FIREBASE_*`. For Option 1 you do nothing in the repo; for Option 2 you only replace those env values with the new project's config.
